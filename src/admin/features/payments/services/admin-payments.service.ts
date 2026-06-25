// src/admin/features/payments/services/admin-payments.service.ts
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { WalletTransaction, WalletTransactionDocument } from '../../../../payments/schemas/wallet-transaction.schema';
import { PayoutRequest, PayoutRequestDocument } from '../../../../payments/schemas/payout-request.schema';
import { WalletRefundRequest, WalletRefundRequestDocument } from '../../../../payments/schemas/wallet-refund-request.schema';
import { GiftCard, GiftCardDocument } from '../../../../payments/schemas/gift-card.schema';

import { AdminActivityLogService } from '../../activity-logs/services/admin-activity-log.service';
import { NotificationService } from '../../../../notifications/services/notification.service';
import { WalletService } from '../../../../payments/services/wallet.service';
import { ProcessPayoutDto } from '../dto/process-payout.dto';
import { ProcessWalletRefundDto } from '../dto/process-wallet-refund.dto';
import { Astrologer, AstrologerDocument } from '../../../../astrologers/schemas/astrologer.schema';
import { User, UserDocument } from '../../../../users/schemas/user.schema';
import { Order, OrderDocument } from '../../../../orders/schemas/orders.schema';
import { CompletePayoutDto } from '../dto/complete-payout.dto';
import { SystemSettings, SystemSettingsDocument } from '../../../../payments/schemas/system-settings.schema';

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(
    @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
    @InjectModel(PayoutRequest.name) private payoutModel: Model<PayoutRequestDocument>,
    @InjectModel(WalletRefundRequest.name) private walletRefundModel: Model<WalletRefundRequestDocument>,
    @InjectModel(GiftCard.name) private giftCardModel: Model<GiftCardDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SystemSettings.name) private systemSettingsModel: Model<SystemSettingsDocument>,
    private activityLogService: AdminActivityLogService,
    private notificationService: NotificationService,
    private walletService: WalletService,
  ) { }

  // ===== TRANSACTIONS =====

  /**
   * Get all transactions
   */
  async getAllTransactions(
    page: number = 1,
    limit: number = 50,
    filters?: { type?: string; status?: string; search?: string; startDate?: string; endDate?: string }
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters?.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
        query.createdAt.$gte.setHours(0, 0, 0, 0);
      }
      if (filters?.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
        query.createdAt.$lte.setHours(23, 59, 59, 999);
      }
    }

    if (filters?.search) {
      const searchTerm = filters.search.trim();
      const userIds = await this.userModel.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { phoneNumber: { $regex: searchTerm, $options: 'i' } }
        ]
      }).distinct('_id');

      query.$or = [
        { transactionId: { $regex: searchTerm, $options: 'i' } },
        { userId: { $in: userIds } }
      ];
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .populate('userId', 'name phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(): Promise<any> {
    const [
      totalRecharge,
      totalSpent,
      totalBonusCredited,
      totalGiftcards,
      totalRefunds,
      totalWithdrawals,
    ] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { type: 'recharge', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { type: 'deduction', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { type: { $in: ['bonus', 'reward', 'refund'] }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { type: 'giftcard', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { type: 'refund', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      success: true,
      data: {
        totalRecharge: totalRecharge[0]?.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
        totalBonusCredited: totalBonusCredited[0]?.total || 0,
        totalGiftcards: totalGiftcards[0]?.total || 0,
        totalOrderRefunds: totalRefunds[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
      },
    };
  }

  // ===== PAYOUTS =====

  /**
   * Get all payouts
   */
  async getAllPayouts(
    page: number = 1,
    limit: number = 50,
    filters?: { status?: string; astrologerId?: string }
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.status) query.status = filters.status;
    if (filters?.astrologerId) {
      query.astrologerId = new Types.ObjectId(filters.astrologerId);
    }

    const [payouts, total] = await Promise.all([
      this.payoutModel
        .find(query)
        .populate('astrologerId', 'name phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.payoutModel.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        payouts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get pending payouts
   */
  async getPendingPayouts(): Promise<any> {
    const payouts = await this.payoutModel
      .find({ status: 'pending' })
      .populate('astrologerId', 'name phoneNumber')
      .sort({ createdAt: 1 })
      .lean();

    return {
      success: true,
      data: payouts,
    };
  }

  /**
   * Get payout details
   */
  async getPayoutDetails(payoutId: string): Promise<any> {
    const payout = await this.payoutModel
      .findOne({ payoutId })
      .populate('astrologerId')
      .lean();

    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    return {
      success: true,
      data: payout,
    };
  }

  /**
   * Approve payout (pending → approved)
   * ❌ Does NOT deduct money yet
   */
  async approvePayout(payoutId: string, adminId: string, processDto: ProcessPayoutDto): Promise<any> {
    const payout = await this.payoutModel.findOne({ payoutId });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    if (payout.status !== 'pending') {
      throw new BadRequestException('Only pending payouts can be approved');
    }

    payout.status = 'approved';
    payout.approvedBy = adminId as any;
    payout.approvedAt = new Date();
    if (processDto.transactionReference) {
      payout.transactionReference = processDto.transactionReference;
    }
    if (processDto.adminNotes) {
      payout.adminNotes = processDto.adminNotes;
    }
    await payout.save();

    // Log activity
    await this.activityLogService.log({
      adminId,
      action: 'payout.approved',
      module: 'payments',
      targetId: payoutId,
      targetType: 'PayoutRequest',
      status: 'success',
      details: {
        amount: payout.amount,
        astrologerId: payout.astrologerId.toString(),
      },
    });

    // Notify astrologer
    await this.notificationService.sendNotification({
      recipientId: payout.astrologerId.toString(),
      recipientModel: 'Astrologer',
      type: 'payout_approved',
      title: 'Payout Approved ✅',
      message: `Your payout request of ₹${payout.amount} has been approved and will be processed soon.`,
      priority: 'high',
    });

    this.logger.log(`✅ Payout approved: ${payoutId} | Amount: ₹${payout.amount}`);

    return {
      success: true,
      message: 'Payout approved successfully. It will be processed shortly.',
      data: payout,
    };
  }

  /**
   * Process payout (approved → processing)
   * ❌ Does NOT deduct money yet
   */
  async processPayout(payoutId: string, adminId: string, processDto: ProcessPayoutDto): Promise<any> {
    const payout = await this.payoutModel.findOne({ payoutId });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    if (payout.status !== 'approved') {
      throw new BadRequestException('Only approved payouts can be processed');
    }

    payout.status = 'processing';
    payout.processedAt = new Date();
    if (processDto.transactionReference) {
      payout.transactionReference = processDto.transactionReference;
    }
    if (processDto.adminNotes) {
      payout.adminNotes = processDto.adminNotes;
    }
    await payout.save();

    // Log activity
    await this.activityLogService.log({
      adminId,
      action: 'payout.processing',
      module: 'payments',
      targetId: payoutId,
      targetType: 'PayoutRequest',
      status: 'success',
      details: {
        amount: payout.amount,
        transactionReference: processDto.transactionReference,
      },
    });

    // Notify astrologer
    await this.notificationService.sendNotification({
      recipientId: payout.astrologerId.toString(),
      recipientModel: 'Astrologer',
      type: 'payout_processing',
      title: 'Payout Processing 🔄',
      message: `Your payout of ₹${payout.amount} is being processed. Money will be credited soon.`,
      priority: 'low',
    });

    this.logger.log(`🔄 Payout processing: ${payoutId} | Amount: ₹${payout.amount}`);

    return {
      success: true,
      message: 'Payout marked as processing',
      data: payout,
    };
  }

  /**
   * Complete payout (processing → completed)
   * ✅ THIS DEDUCTS MONEY FROM ASTROLOGER BALANCE
   */
  async completePayout(
    payoutId: string,
    adminId: string,
    completeDto: CompletePayoutDto,
  ): Promise<any> {
    const payout = await this.payoutModel.findOne({ payoutId });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    if (!['pending', 'approved', 'processing'].includes(payout.status)) {
      throw new BadRequestException('Cannot complete this payout from its current status');
    }

    // ✅ Get astrologer to verify balance
    const astrologer = await this.astrologerModel.findById(payout.astrologerId);
    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // ✅ Double-check pending withdrawal amount instead of withdrawable amount 
    // because the amount was already locked in pendingWithdrawal during requestPayout
    const availablePending = astrologer.earnings.pendingWithdrawal || 0;
    if (availablePending < payout.amount) {
      // Allow completion if it's an old request where it wasn't locked properly, but ensure they had enough balance
      const totalAvailable = availablePending + (astrologer.earnings.withdrawableAmount || 0);
      if (totalAvailable < payout.amount) {
        throw new BadRequestException(
          `Insufficient balance. Available: ₹${totalAvailable}, Required: ₹${payout.amount}`
        );
      }
    }

    // ✅ Update payout status
    const now = new Date();
    payout.status = 'completed';
    payout.completedAt = now;
    
    // Backfill skipped steps
    if (!payout.approvedBy) {
      payout.approvedBy = adminId as any;
      payout.approvedAt = now;
    }
    if (!payout.processedAt) {
      payout.processedAt = now;
    }
    
    payout.transactionReference = completeDto.transactionReference;
    if (completeDto.adminNotes) {
      payout.adminNotes = completeDto.adminNotes;
    }
    await payout.save();

    // ✅ Deduct from astrologer earnings
    const previousWithdrawable = astrologer.earnings.withdrawableAmount || 0;
    const previousWithdrawn = astrologer.earnings.totalWithdrawn || 0;
    const previousPending = astrologer.earnings.pendingWithdrawal || 0;

    const newTotalWithdrawn = previousWithdrawn + payout.amount;
    const newPendingWithdrawal = Math.max(0, previousPending - payout.amount);

    await this.astrologerModel.updateOne(
      { _id: astrologer._id },
      {
        $set: {
          'earnings.totalWithdrawn': newTotalWithdrawn,
          'earnings.pendingWithdrawal': newPendingWithdrawal,
          'earnings.withdrawableAmount': previousWithdrawable,
          'earnings.lastUpdated': new Date()
        }
      }
    );

    try {
      // ✅ Log activity
      await this.activityLogService.log({
        adminId,
        action: 'payout.completed',
        module: 'payments',
        targetId: payoutId,
        targetType: 'PayoutRequest',
        status: 'success',
        details: {
          amount: payout.amount,
          astrologerId: payout.astrologerId.toString(),
          transactionReference: completeDto.transactionReference,
          previousBalance: previousWithdrawable,
          newBalance: previousWithdrawable,
        },
      });

      // ✅ Notify astrologer
      if (this.notificationService) {
        await this.notificationService.sendNotification({
          recipientId: payout.astrologerId.toString(),
          recipientModel: 'Astrologer',
          type: 'payout_completed',
          title: 'Payout Completed 💰',
          message: `Your payout of ₹${payout.amount} has been successfully transferred to your bank account.`,
          priority: 'high',
        });
      }
    } catch (err) {
      this.logger.error(`Error logging/notifying for payout ${payoutId}: ${err.message}`);
    }

    this.logger.log(
      `✅ Payout completed: ${payoutId} | Amount: ₹${payout.amount} | Ref: ${completeDto.transactionReference}`
    );

    return {
      success: true,
      message: 'Payout completed successfully. Amount deducted from astrologer balance.',
      data: {
        payout,
        astrologerBalance: {
          previousWithdrawable,
          newWithdrawable: previousWithdrawable,
          totalWithdrawn: newTotalWithdrawn,
        },
      },
    };
  }

  /**
   * Reject payout
   */
  async rejectPayout(payoutId: string, adminId: string, reason: string): Promise<any> {
    const payout = await this.payoutModel.findOne({ payoutId });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    if (payout.status !== 'pending' && payout.status !== 'approved') {
      throw new BadRequestException('Cannot reject this payout');
    }

    payout.status = 'rejected';
    payout.rejectedAt = new Date();

    payout.rejectionReason = reason;
    await payout.save();

    // ✅ Release the pending balance back to withdrawable
    const astrologer = await this.astrologerModel.findById(payout.astrologerId);
    if (astrologer) {
      await this.astrologerModel.findByIdAndUpdate(payout.astrologerId, {
        $inc: {
          'earnings.pendingWithdrawal': -payout.amount,
          'earnings.withdrawableAmount': payout.amount,
        },
        $set: {
          'earnings.lastUpdated': new Date()
        }
      });
    }

    // Log activity
    await this.activityLogService.log({
      adminId,
      action: 'payout.rejected',
      module: 'payments',
      targetId: payoutId,
      targetType: 'PayoutRequest',
      status: 'success',
      details: {
        amount: payout.amount,
        reason,
      },
    });

    // Notify astrologer
    await this.notificationService.sendNotification({
      recipientId: payout.astrologerId.toString(),
      recipientModel: 'Astrologer',
      type: 'payout_rejected',
      title: 'Payout Rejected ❌',
      message: `Your payout request has been rejected. Reason: ${reason}`,
      priority: 'high',
    });

    this.logger.log(`❌ Payout rejected: ${payoutId} | Reason: ${reason}`);

    return {
      success: true,
      message: 'Payout rejected',
      data: payout,
    };
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats(): Promise<any> {
    const [total, pending, approved, rejected, totalAmount] = await Promise.all([
      this.payoutModel.countDocuments(),
      this.payoutModel.countDocuments({ status: 'pending' }),
      this.payoutModel.countDocuments({ status: { $in: ['approved', 'completed'] } }),
      this.payoutModel.countDocuments({ status: 'rejected' }),
      this.payoutModel.aggregate([
        { $match: { status: { $in: ['approved', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        totalAmount: totalAmount[0]?.total || 0,
      },
    };
  }

  /**
   * Financial Audit for a specific payout
   */
  async getFinancialAudit(payoutId: string): Promise<any> {
    const payout = await this.payoutModel.findOne({ payoutId }).lean();
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    const astrologerId = payout.astrologerId;

    // 1. Establish the Audit Window (From previous payout -> This payout)
    const previousPayout = await this.payoutModel
      .findOne({
        astrologerId,
        status: 'completed',
        createdAt: { $lt: payout.createdAt },
      })
      .sort({ createdAt: -1 })
      .lean();

    const fromDate = previousPayout ? previousPayout.createdAt : new Date(0); // Epoch if first payout
    const toDate = payout.createdAt;

    // 2. Fetch Orders (Organic Revenue generation)
    const completedOrders = await this.orderModel
      .find({
        astrologerId,
        status: 'completed',
        createdAt: { $gte: fromDate, $lte: toDate },
      })
      .select('orderId type createdAt totalAmount billedMinutes')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fetch Refunds (Revenue loss/User chargebacks)
    const refundedOrders = await this.orderModel
      .find({
        astrologerId,
        status: 'refunded',
        createdAt: { $gte: fromDate, $lte: toDate },
      })
      .select('orderId type createdAt refundRequest.refundAmount status')
      .sort({ createdAt: -1 })
      .lean();

    // 4. Fetch Penalties (Platform fines)
    const astrologer = await this.astrologerModel.findById(astrologerId).lean();
    const penalties = astrologer?.penalties?.filter(
      (p) =>
        p.appliedAt && // ✅ Fix for undefined validation
        new Date(p.appliedAt) >= fromDate &&
        new Date(p.appliedAt) <= toDate &&
        p.status === 'applied',
    ) || [];

    // Calculate Totals within this Window
    const totalOrderRevenue = completedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalRefundLoss = refundedOrders.reduce((sum, order) => sum + (order.refundRequest?.refundAmount || 0), 0);
    const totalPenaltyLoss = penalties.reduce((sum, p) => sum + p.amount, 0);

    return {
      success: true,
      data: {
        auditWindow: {
          from: fromDate,
          to: toDate,
        },
        summary: {
          totalOrderRevenue,
          totalRefundLoss,
          totalPenaltyLoss,
          requestedPayout: payout.amount,
        },
        records: {
          completedOrders,
          refundedOrders,
          penalties,
        }
      },
    };
  }

  // ===== WALLET REFUNDS =====

  /**
   * List wallet refund requests
   */
  async listWalletRefundRequests(
    page: number = 1,
    limit: number = 50,
    filters?: { status?: string; userId?: string },
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.status) query.status = filters.status;
    if (filters?.userId) query.userId = filters.userId;

    const [requests, total] = await Promise.all([
      this.walletRefundModel
        .find(query)
        .populate('userId', 'name phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.walletRefundModel.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get wallet refund details
   */
  async getWalletRefundDetails(refundId: string): Promise<any> {
    const request = await this.walletRefundModel
      .findOne({ refundId })
      .populate('userId', 'name phoneNumber')
      .lean();

    if (!request) {
      throw new NotFoundException('Wallet refund request not found');
    }

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Process wallet refund
   */
  async processWalletRefund(
    refundId: string,
    adminId: string,
    payload: ProcessWalletRefundDto,
  ): Promise<any> {
    const result = await this.walletService.processWalletRefund(
      refundId,
      adminId,
      payload,
    );

    await this.activityLogService.log({
      adminId,
      action: 'walletRefund.processed',
      module: 'payments',
      targetId: refundId,
      targetType: 'WalletRefundRequest',
      status: 'success',
      details: {
        amountApproved: payload.amountApproved,
        paymentReference: payload.paymentReference,
      },
    });

    return result;
  }

  // ===== GIFT CARDS =====

  /**
   * Create gift card
   */
  async createGiftCard(params: {
    code: string;
    amount: number;
    currency?: string;
    maxRedemptions?: number;
    expiresAt?: Date;
    metadata?: Record<string, any>;
    createdBy: string;
  }): Promise<any> {
    const normalizedCode = params.code.trim().toUpperCase();

    const existing = await this.giftCardModel.findOne({ code: normalizedCode });
    if (existing) {
      throw new BadRequestException('Gift card code already exists');
    }

    const giftCard = new this.giftCardModel({
      code: normalizedCode,
      amount: params.amount,
      currency: params.currency || 'INR',
      maxRedemptions: params.maxRedemptions ?? 1,
      status: 'active',
      expiresAt: params.expiresAt,
      createdBy: params.createdBy,
      metadata: params.metadata,
    });

    await giftCard.save();

    await this.activityLogService.log({
      adminId: params.createdBy,
      action: 'giftcard.created',
      module: 'payments',
      targetId: giftCard.code,
      targetType: 'GiftCard',
      status: 'success',
      details: {
        amount: giftCard.amount,
        currency: giftCard.currency,
        maxRedemptions: giftCard.maxRedemptions,
      },
    });

    this.logger.log(`Gift card created: ${giftCard.code} | Amount: ₹${giftCard.amount}`);

    return {
      success: true,
      message: 'Gift card created successfully',
      data: giftCard,
    };
  }

  /**
   * List gift cards
   */
  async listGiftCards(
    page: number = 1,
    limit: number = 50,
    filters?: { status?: string; search?: string },
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      const term = filters.search.trim().toUpperCase();
      query.code = { $regex: term, $options: 'i' };
    }

    const [giftCards, total] = await Promise.all([
      this.giftCardModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.giftCardModel.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        giftCards,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get gift card
   */
  async getGiftCard(code: string): Promise<any> {
    const normalizedCode = code.trim().toUpperCase();

    const giftCard = await this.giftCardModel
      .findOne({ code: normalizedCode })
      .lean();

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    return {
      success: true,
      data: giftCard,
    };
  }

  /**
   * Update gift card status
   */
  async updateGiftCardStatus(
    code: string,
    adminId: string,
    status: 'active' | 'disabled' | 'expired',
  ): Promise<any> {
    const normalizedCode = code.trim().toUpperCase();

    const giftCard = await this.giftCardModel.findOne({ code: normalizedCode });
    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    giftCard.status = status;
    await giftCard.save();

    await this.activityLogService.log({
      adminId,
      action: 'giftcard.status_updated',
      module: 'payments',
      targetId: giftCard.code,
      targetType: 'GiftCard',
      status: 'success',
      details: { status },
    });

    this.logger.log(`Gift card status updated: ${giftCard.code} | Status: ${status}`);

    return {
      success: true,
      message: 'Gift card status updated',
      data: { code: giftCard.code, status: giftCard.status },
    };
  }

  async refundRazorpayTransaction(transactionId: string, adminId: string, reason: string) {
    // Delegate to WalletService
    return this.walletService.refundRazorpayTransaction(transactionId, adminId, reason);
  }

  async manageUserBonus(userId: string, amount: number, action: 'add' | 'deduct', reason: string, adminId: string) {
    return this.walletService.manageUserBonus(userId, amount, action, reason, adminId);
  }

  async getCommissionSettings(): Promise<any> {
    let settings = await this.systemSettingsModel.findOne();
    if (!settings) {
      settings = new this.systemSettingsModel({ defaultPlatformCommissionRate: 50 });
      await settings.save();
    }
    return {
      success: true,
      data: settings,
    };
  }

  async updateCommissionSettings(updateData: {
    defaultPlatformCommissionRate?: number;
    isAiFirstCallFreeEnabled?: boolean;
    aiFirstCallFreeDurationMinutes?: number;
    isWelcomeBonusEnabled?: boolean;
    welcomeBonusAmount?: number;
    isPromoBannerActive?: boolean;
    promoBannerTitle?: string;
    promoBannerSubtitle?: string;
    promoBannerCallText?: string;
    promoBannerChatText?: string;
    promoBannerShowCall?: boolean;
    promoBannerShowChat?: boolean;
    promoBannerImage?: string;
    promoBannerRedirectRoute?: string;
  }): Promise<any> {
    let settings = await this.systemSettingsModel.findOne();
    if (!settings) {
      settings = new this.systemSettingsModel({
        defaultPlatformCommissionRate: updateData.defaultPlatformCommissionRate ?? 50,
        isAiFirstCallFreeEnabled: updateData.isAiFirstCallFreeEnabled ?? false,
        aiFirstCallFreeDurationMinutes: updateData.aiFirstCallFreeDurationMinutes ?? 1,
        isWelcomeBonusEnabled: updateData.isWelcomeBonusEnabled ?? false,
        welcomeBonusAmount: updateData.welcomeBonusAmount ?? 100,
        isPromoBannerActive: updateData.isPromoBannerActive ?? false,
        promoBannerTitle: updateData.promoBannerTitle ?? 'First Call/Chat FREE',
        promoBannerSubtitle: updateData.promoBannerSubtitle ?? 'Consult Expert AI Astrologers',
        promoBannerCallText: updateData.promoBannerCallText ?? 'Call Now',
        promoBannerChatText: updateData.promoBannerChatText ?? 'Chat Now',
        promoBannerShowCall: updateData.promoBannerShowCall ?? true,
        promoBannerShowChat: updateData.promoBannerShowChat ?? true,
        promoBannerImage: updateData.promoBannerImage ?? '',
        promoBannerRedirectRoute: updateData.promoBannerRedirectRoute ?? '',
      });
    } else {
      if (updateData.defaultPlatformCommissionRate !== undefined) {
        if (isNaN(updateData.defaultPlatformCommissionRate) || updateData.defaultPlatformCommissionRate < 0 || updateData.defaultPlatformCommissionRate > 100) {
          throw new BadRequestException('Invalid commission rate. Must be a number between 0 and 100.');
        }
        settings.defaultPlatformCommissionRate = updateData.defaultPlatformCommissionRate;
      }
      if (updateData.isAiFirstCallFreeEnabled !== undefined) {
        settings.isAiFirstCallFreeEnabled = updateData.isAiFirstCallFreeEnabled;
      }
      if (updateData.aiFirstCallFreeDurationMinutes !== undefined) {
        settings.aiFirstCallFreeDurationMinutes = updateData.aiFirstCallFreeDurationMinutes;
      }
      if (updateData.isWelcomeBonusEnabled !== undefined) {
        settings.isWelcomeBonusEnabled = updateData.isWelcomeBonusEnabled;
      }
      if (updateData.welcomeBonusAmount !== undefined) {
        if (isNaN(updateData.welcomeBonusAmount) || updateData.welcomeBonusAmount < 0) {
          throw new BadRequestException('Invalid bonus amount. Must be a positive number.');
        }
        settings.welcomeBonusAmount = updateData.welcomeBonusAmount;
      }
      if (updateData.isPromoBannerActive !== undefined) {
        settings.isPromoBannerActive = updateData.isPromoBannerActive;
      }
      if (updateData.promoBannerTitle !== undefined) {
        settings.promoBannerTitle = updateData.promoBannerTitle;
      }
      if (updateData.promoBannerSubtitle !== undefined) {
        settings.promoBannerSubtitle = updateData.promoBannerSubtitle;
      }
      if (updateData.promoBannerCallText !== undefined) {
        settings.promoBannerCallText = updateData.promoBannerCallText;
      }
      if (updateData.promoBannerChatText !== undefined) {
        settings.promoBannerChatText = updateData.promoBannerChatText;
      }
      if (updateData.promoBannerShowCall !== undefined) {
        settings.promoBannerShowCall = updateData.promoBannerShowCall;
      }
      if (updateData.promoBannerShowChat !== undefined) {
        settings.promoBannerShowChat = updateData.promoBannerShowChat;
      }
      if (updateData.promoBannerImage !== undefined) {
        settings.promoBannerImage = updateData.promoBannerImage;
      }
      if (updateData.promoBannerRedirectRoute !== undefined) {
        settings.promoBannerRedirectRoute = updateData.promoBannerRedirectRoute;
      }
    }
    await settings.save();
    return {
      success: true,
      message: 'System settings updated successfully',
      data: settings,
    };
  }
}
