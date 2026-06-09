// src/astrologers/controllers/astrologer-profile.controller.ts

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AstrologersService } from '../services/astrologers.service';
import { AstrologerService } from '../services/astrologer.service';
import { AvailabilityService } from '../services/availability.service';
import { ProfileChangeService } from '../services/profile-change.service';
import { EarningsService } from '../services/earnings.service';
import { PenaltyService } from '../services/penalty.service';
import { WalletService } from '../../payments/services/wallet.service';
import { UpdateAstrologerProfileDto } from '../dto/update-astrologer-profile.dto';
import { UpdateWorkingHoursDto } from '../dto/update-working-hours.dto';
import { UpdateAvailabilityDto } from '../dto/update-availability.dto';
import { RequestProfileChangeDto } from '../dto/request-profile-change.dto';
import { GiftService } from '../../payments/services/gift.service';

interface AuthenticatedRequest extends Request {
  user: { _id: string; astrologerId?: string };
}

@Controller('astrologer')
@UseGuards(JwtAuthGuard)
export class AstrologerProfileController {
  constructor(
    private astrologersService: AstrologersService,
    private astrologerService: AstrologerService,
    private availabilityService: AvailabilityService,
    private profileChangeService: ProfileChangeService,
    private earningsService: EarningsService,
    private penaltyService: PenaltyService,
    private walletService: WalletService,
    private giftService: GiftService,
  ) { }

  // ===== PROFILE MANAGEMENT =====

  @Get('profile/complete')
  async getCompleteProfile(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.getCompleteProfile(astrologerId);
  }

  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologersService.getOwnProfile(astrologerId);
  }

  @Get('profile/completion')
  async getProfileCompletion(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.getProfileCompletionStatus(astrologerId);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateDto: UpdateAstrologerProfileDto,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologersService.updateProfile(astrologerId, updateDto);
  }

  @Post('profile/phone/send-otp')
  async sendPhoneChangeOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phoneNumber: string; countryCode: string }
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologersService.sendPhoneChangeOtp(astrologerId, body.phoneNumber, body.countryCode);
  }

  @Post('profile/phone/verify-otp')
  async verifyPhoneChangeOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phoneNumber: string; countryCode: string; otp: string }
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologersService.verifyPhoneChangeOtp(astrologerId, body.phoneNumber, body.countryCode, body.otp);
  }

  @Patch('profile/pricing')
  async updatePricing(
    @Req() req: AuthenticatedRequest,
    @Body() pricingData: { chat: number; call: number; videoCall?: number },
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.updatePricing(astrologerId, pricingData);
  }

  // ===== AVAILABILITY MANAGEMENT =====

  @Get('availability')
  async getAvailability(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.availabilityService.getWorkingHours(astrologerId);
  }

  @Patch('profile/working-hours')
  async updateWorkingHours(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateDto: UpdateWorkingHoursDto,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.availabilityService.updateWorkingHours(astrologerId, updateDto);
  }

  @Patch('availability')
  async updateAvailability(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateDto: UpdateAvailabilityDto,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.availabilityService.updateAvailability(astrologerId, updateDto);
  }

  @Post('status/online')
  @HttpCode(HttpStatus.OK)
  async toggleOnline(
    @Req() req: AuthenticatedRequest,
    @Body() body: { isOnline: boolean },
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.toggleOnlineStatus(astrologerId, body.isOnline);
  }

  @Post('status/available')
  @HttpCode(HttpStatus.OK)
  async toggleAvailability(
    @Req() req: AuthenticatedRequest,
    @Body() body: { isAvailable: boolean },
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.toggleAvailability(astrologerId, body.isAvailable);
  }

  // ===== PROFILE CHANGE REQUESTS =====

  @Post('profile/change-request')
  async requestProfileChange(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) requestDto: RequestProfileChangeDto,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.profileChangeService.requestChange(astrologerId, requestDto);
  }

  @Get('profile/change-requests')
  async getMyChangeRequests(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.profileChangeService.getMyChangeRequests(astrologerId);
  }

  // ===== EARNINGS DASHBOARD =====

  @Get('earnings/dashboard')
  async getEarningsDashboard(@Req() req: AuthenticatedRequest) {
    const astrologerId = req.user.astrologerId || req.user._id;

    const [astrologer, transactions, penalties] = await Promise.all([
      this.astrologersService.astrologerModel
        .findById(astrologerId)
        .select('name earnings stats ratings pricing')
        .lean(),
      this.walletService['transactionModel']
        .find({
          userId: new Types.ObjectId(astrologerId),
          userModel: 'Astrologer',
          type: 'earning',
          status: 'completed',
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.penaltyService.getPenalties(astrologerId),
    ]);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // ... (rest of dashboard logic remains same) ...
    // Calculate revenue breakdown by service type
    const callRevenue = transactions
      .filter(
        (t: any) =>
          t.metadata?.sessionType === 'audio_call' || t.metadata?.sessionType === 'video_call',
      )
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const chatRevenue = transactions
      .filter((t: any) => t.metadata?.sessionType === 'chat')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const streamRevenue = transactions
      .filter((t: any) => t.metadata?.sessionType === 'stream_call')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const weeklyTrend: { date: string; earnings: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayEarnings = transactions
        .filter((t: any) => {
          const tDate = new Date(t.createdAt);
          return tDate >= date && tDate < nextDate;
        })
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      weeklyTrend.push({
        date: date.toISOString().split('T')[0],
        earnings: dayEarnings,
      });
    }

    const recentTransactions = transactions.slice(0, 10).map((t: any) => ({
      transactionId: t.transactionId,
      amount: t.amount,
      type: t.metadata?.sessionType || 'unknown',
      userName: t.metadata?.userName || 'User',
      createdAt: t.createdAt,
    }));

    return {
      success: true,
      data: {
        summary: {
          totalEarned: astrologer.earnings.totalEarned || 0,
          platformCommission: astrologer.earnings.platformCommission || 0,
          platformCommissionRate: astrologer.earnings?.platformCommissionRate ?? 50,
          netEarnings: astrologer.earnings.netEarnings || 0,
          totalPenalties: astrologer.earnings.totalPenalties || 0,
          withdrawableAmount: astrologer.earnings.withdrawableAmount || 0,
          totalWithdrawn: astrologer.earnings.totalWithdrawn || 0,
          pendingWithdrawal: astrologer.earnings.pendingWithdrawal || 0,
        },
        stats: {
          totalOrders: astrologer.stats.totalOrders || 0,
          callOrders: astrologer.stats.callOrders || 0,
          chatOrders: astrologer.stats.chatOrders || 0,
          totalMinutes: astrologer.stats.totalMinutes || 0,
          repeatCustomers: astrologer.stats.repeatCustomers || 0,
          averageRating: astrologer.ratings.average || 0,
        },
        revenueBreakdown: {
          call: callRevenue,
          chat: chatRevenue,
          stream: streamRevenue,
          total: callRevenue + chatRevenue + streamRevenue,
        },
        weeklyTrend,
        recentTransactions,
        penalties: penalties.data.penalties || [],
        totalPenaltyAmount: astrologer.earnings.totalPenalties || 0,
        pricing: astrologer.pricing,
      },
    };
  }

  // ===== EARNINGS (UPDATED) =====

  @Get('earnings')
  async getEarnings(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;

    if (!startDate || !endDate) {
      return this.earningsService.getEarningsSummary(astrologerId);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Calculate Earnings
    const stats = await this.walletService['transactionModel'].aggregate([
      {
        $match: {
          userId: new Types.ObjectId(astrologerId),
          userModel: 'Astrologer',
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
          $or: [{ type: 'session_payment' }, { type: 'gift' }, { type: 'earning' }],
        },
      },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$amount' },
          totalPlatformCommission: { $sum: '$platformCommission' },
        },
      },
    ]);

    // 2. Calculate Penalties for this range
    let totalPenalties = 0;
    try {
      const penaltiesRes = await this.penaltyService.getPenalties(astrologerId);
      if (penaltiesRes.success && penaltiesRes.data?.penalties) {
        totalPenalties = penaltiesRes.data.penalties
          .filter((p: any) => {
            const pDate = new Date(p.createdAt);
            return pDate >= start && pDate <= end;
          })
          .reduce((sum: number, p: any) => sum + p.amount, 0);
      }
    } catch (err) {
      console.error('Error fetching penalties for range:', err);
    }

    const result = stats[0] || { totalEarned: 0, totalPlatformCommission: 0 };
    const netEarnings = result.totalEarned;
    const commission = result.totalPlatformCommission;
    const grossTotal = netEarnings + commission;

    return {
      success: true,
      data: {
        totalEarned: grossTotal,
        platformCommission: commission,
        netEarnings: netEarnings,
        withdrawableAmount: netEarnings,
        totalPenalties: totalPenalties, // ✅ Now calculated correctly
        platformCommissionRate: 50,
        pendingWithdrawal: 0,
        totalWithdrawn: 0,
      },
    };
  }

  // ===== STATS (UPDATED) =====

  @Get('stats')
  async getStats(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;

    // 1. Prepare Match Query
    const matchQuery: any = {
      userId: new Types.ObjectId(astrologerId),
      userModel: 'Astrologer',
      status: 'completed',
      type: 'session_payment', // Matches standard sessions
    };

    // If date filters are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt = { $gte: start, $lte: end };
    }

    // 2. Aggregate Stats
    const stats = await this.walletService['transactionModel'].aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$sessionType', // groups by: audio_call, video_call, chat, stream_call
          count: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ['$metadata.durationMinutes', 0] } }, // ✅ FIXED: use 'durationMinutes'
        },
      },
    ]);

    // ... (repeat customers logic) ...
    const repeatUserStats = await this.walletService['transactionModel'].aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$relatedUserId',
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
      {
        $count: 'repeatCount',
      },
    ]);
    const repeatCustomers = repeatUserStats[0]?.repeatCount || 0;

    // 4. Calculate Totals
    let totalOrders = 0;
    let callOrders = 0;
    let chatOrders = 0;
    let streamOrders = 0;
    let totalMinutes = 0;

    stats.forEach((s) => {
      totalOrders += s.count;
      totalMinutes += s.totalMinutes; // ✅ Summing everything

      if (s._id === 'chat') {
        chatOrders += s.count;
      } else if (s._id === 'audio_call' || s._id === 'video_call') {
        callOrders += s.count;
      } else if (s._id === 'stream_call') {
        streamOrders += s.count;
      }
    });

    return {
      success: true,
      data: {
        totalOrders,
        callOrders,
        chatOrders,
        streamOrders,
        totalMinutes: Math.round(totalMinutes), // ✅ FIXED: Metadata is already in minutes
        repeatCustomers: repeatCustomers,
        totalEarnings: 0,
      },
    };
  }

  // ===== TRANSACTIONS & GIFTS (SAME AS BEFORE) =====

  @Get('transactions')
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('sessionType') sessionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    const skip = (page - 1) * limit;

    const query: any = {
      userId: new Types.ObjectId(astrologerId),
      userModel: 'Astrologer',
      status: 'completed',
    };

    if (type) query.type = type;
    if (sessionType) query.sessionType = sessionType;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const [transactions, total] = await Promise.all([
      this.walletService['transactionModel']
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.walletService['transactionModel'].countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        transactions: transactions.map((t: any) => ({
          transactionId: t.transactionId,
          type: t.type,
          amount: t.amount,
          grossAmount: t.grossAmount,
          platformCommission: t.platformCommission,
          netAmount: t.netAmount,
          description: t.description,
          sessionType: t.sessionType,
          sessionId: t.sessionId,
          orderId: t.orderId,
          relatedUserId: t.relatedUserId,
          userName: t.metadata?.userName,
          giftType: t.metadata?.giftType,
          context: t.metadata?.context,
          createdAt: t.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  }

  @Get('transactions/stats')
  async getTransactionStats(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;

    const matchQuery: any = {
      userId: new Types.ObjectId(astrologerId),
      userModel: 'Astrologer',
      status: 'completed',
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt = { $gte: start, $lte: end };
    }

    const stats = await this.walletService['transactionModel'].aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$platformCommission' },
        },
      },
    ]);

    const sessionStats = await this.walletService['transactionModel'].aggregate([
      {
        $match: {
          ...matchQuery,
          type: 'session_payment',
        },
      },
      {
        $group: {
          _id: '$sessionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalGross: { $sum: '$grossAmount' },
        },
      },
    ]);

    return {
      success: true,
      data: {
        byType: stats.reduce((acc: any, stat: any) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount,
            totalGross: stat.totalGross || 0,
            totalCommission: stat.totalCommission || 0,
          };
          return acc;
        }, {}),
        bySessionType: sessionStats.reduce((acc: any, stat: any) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount,
            totalGross: stat.totalGross || 0,
          };
          return acc;
        }, {}),
      },
    };
  }

  @Get('gifts/stats')
  async getGiftStats(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;

    const matchQuery: any = {
      userId: new Types.ObjectId(astrologerId),
      userModel: 'Astrologer',
      status: 'completed',
      $or: [
        { type: 'gift' },
        { 'metadata.context': 'gift' }
      ]
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt = { $gte: start, $lte: end };
    }

    const giftStats = await this.walletService['transactionModel'].aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$metadata.context',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        }
      }
    ]);

    let totalGifts = 0;
    let totalEarned = 0;
    let directGifts = { count: 0, amount: 0 };
    let streamGifts = { count: 0, amount: 0 };

    giftStats.forEach(stat => {
      totalGifts += stat.count;
      totalEarned += stat.totalAmount;

      if (stat._id === 'direct') {
        directGifts = { count: stat.count, amount: stat.totalAmount };
      } else if (stat._id === 'stream') {
        streamGifts = { count: stat.count, amount: stat.totalAmount };
      }
    });

    return {
      success: true,
      data: {
        totalGifts,
        totalEarned,
        directGifts,
        streamGifts,
      },
    };
  }

  // ===== ACCOUNT SETTINGS =====

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: { reason?: string } // Optional reason
  ) {
    const astrologerId = req.user.astrologerId || req.user._id;
    return this.astrologerService.deleteAccount(astrologerId, body?.reason);
  }
}