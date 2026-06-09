// src/astrologers/services/earnings.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Astrologer, AstrologerDocument } from '../schemas/astrologer.schema';

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
  ) { }

  /**
   * ✅ FIXED: Update earnings correctly with platform commission
   * @param astrologerId - Astrologer ID
   * @param grossAmount - GROSS amount (user charged amount)
   * @param sessionType - 'call' or 'chat'
   */
  async updateEarnings(
    astrologerId: string,
    grossAmount: number,
    sessionType: 'call' | 'chat',
    durationMinutes?: number, // ✅ Optional explicit duration
    astrologerEarningAmount?: number,
    platformCommissionAmount?: number,
  ): Promise<void> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    let netEarnings = astrologerEarningAmount;
    let commission = platformCommissionAmount;

    if (netEarnings === undefined || commission === undefined) {
      let commissionRate = 50;
      if (astrologer.earnings && typeof astrologer.earnings.platformCommissionRate === 'number') {
        commissionRate = astrologer.earnings.platformCommissionRate;
      }
      commission = (grossAmount * commissionRate) / 100;
      netEarnings = grossAmount - commission;
    }

    // Calculate minutes if not provided
    let minutes = durationMinutes;
    if (minutes === undefined) {
      const rate = sessionType === 'call' ? astrologer.pricing.call : astrologer.pricing.chat;
      minutes = Math.ceil(grossAmount / (rate || 1));
    }

    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $inc: {
        'earnings.totalEarned': grossAmount, // Total revenue generated
        'earnings.platformCommission': commission, // Platform's share
        'earnings.netEarnings': netEarnings, // Astrologer's share
        'earnings.withdrawableAmount': netEarnings, // Available to withdraw
        'stats.totalEarnings': netEarnings, // Legacy field
        'stats.totalOrders': 1,
        'stats.totalMinutes': Math.round(minutes || 0),
        ...(sessionType === 'call' && { 'stats.callOrders': 1, 'stats.callMinutes': Math.round(minutes || 0) }),
        ...(sessionType === 'chat' && { 'stats.chatOrders': 1, 'stats.chatMinutes': Math.round(minutes || 0) }),
      },
      $set: {
        'earnings.lastUpdated': new Date(),
      },
    });

    this.logger.log(
      `✅ Earnings updated: Astrologer ${astrologerId} | Gross: ₹${grossAmount} | Minutes: ${minutes} | Net: ₹${netEarnings.toFixed(2)}`,
    );
  }

  /**
    * Record gift earnings
    * ✅ FIXED: Now updates specific gift stats
    */
  async recordGiftEarning(
    astrologerId: string,
    amount: number,
    astrologerEarningAmount?: number,
    platformCommissionAmount?: number,
  ): Promise<void> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    let astrologerEarning = astrologerEarningAmount;
    let commission = platformCommissionAmount;

    if (astrologerEarning === undefined || commission === undefined) {
      let commissionRate = 50;
      if (astrologer.earnings && typeof astrologer.earnings.platformCommissionRate === 'number') {
        commissionRate = astrologer.earnings.platformCommissionRate;
      }
      commission = (amount * commissionRate) / 100;
      astrologerEarning = amount - commission;
    }

    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $inc: {
        // 1. General Earnings
        'earnings.totalEarned': amount,
        'earnings.platformCommission': commission,
        'earnings.netEarnings': astrologerEarning,
        'earnings.withdrawableAmount': astrologerEarning,

        // 2. ✅ SPECIFIC GIFT TRACKING (The Missing Part)
        'earnings.totalGiftEarnings': amount,

        // 3. Stats
        'stats.totalEarnings': astrologerEarning,
        'stats.totalGifts': 1 // ✅ Increment gift count
      },
      $set: {
        'earnings.lastUpdated': new Date(),
      },
    });

    this.logger.log(`Gift recorded for ${astrologerId}: +₹${amount} (Net: ₹${astrologerEarning})`);
  }

  /**
   * Get earnings summary
   */
  async getEarningsSummary(astrologerId: string): Promise<any> {
    const astrologer = await this.astrologerModel
      .findById(astrologerId)
      .select('earnings stats')
      .lean();

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    return {
      success: true,
      data: {
        totalEarned: astrologer.earnings.totalEarned || 0,
        totalGiftEarnings: astrologer.earnings.totalGiftEarnings || 0,
        platformCommission: astrologer.earnings.platformCommission || 0,
        platformCommissionRate: 50,
        netEarnings: astrologer.earnings.netEarnings || 0,
        totalPenalties: astrologer.earnings.totalPenalties || 0,
        withdrawableAmount: astrologer.earnings.withdrawableAmount || 0,
        totalWithdrawn: astrologer.earnings.totalWithdrawn || 0,
        pendingWithdrawal: astrologer.earnings.pendingWithdrawal || 0,
        lastUpdated: astrologer.earnings.lastUpdated,
      },
    };
  }

  /**
   * Get stats
   */
  async getStats(astrologerId: string): Promise<any> {
    const astrologer = await this.astrologerModel
      .findById(astrologerId)
      .select('stats')
      .lean();

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    return {
      success: true,
      data: {
        totalOrders: astrologer.stats.totalOrders || 0,
        callOrders: astrologer.stats.callOrders || 0,
        chatOrders: astrologer.stats.chatOrders || 0,
        totalMinutes: astrologer.stats.totalMinutes || 0,
        repeatCustomers: astrologer.stats.repeatCustomers || 0,
        totalEarnings: astrologer.stats.totalEarnings || 0,
      },
    };
  }
}
