import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from '../../../../users/schemas/user.schema';
import { Astrologer, AstrologerDocument } from '../../../../astrologers/schemas/astrologer.schema';
import { Order, OrderDocument } from '../../../../orders/schemas/orders.schema';
import { CallSession, CallSessionDocument } from '../../../../calls/schemas/call-session.schema';
import { ChatSession, ChatSessionDocument } from '../../../../chat/schemas/chat-session.schema';
import { WalletTransaction, WalletTransactionDocument } from '../../../../payments/schemas/wallet-transaction.schema';

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(CallSession.name) private callSessionModel: Model<CallSessionDocument>,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
  ) { }

  async getDashboardAnalytics(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalAstrologers,
      testUserIds,
      testAstrologerIds
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.astrologerModel.countDocuments(),
      // Fetch ObjectIDs of designated test accounts to exclude them from platform math
      this.userModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878', '+917347414419', '7347414419', '+916284796246', '6284796246'] } }).select('_id'),
      this.astrologerModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878'] } }).select('_id')
    ]);

    const excludedUserIds = testUserIds.map(u => u._id);
    const excludedAstrologerIds = testAstrologerIds.map(a => a._id);

    // ✅ ROBUST FILTER: Exclude AI sessions and Test Accounts
    const aiExclude = {
      isAi: { $ne: true },
      astrologerModel: { $ne: 'AiAstrologerProfile' },
      sessionId: { $not: /^AI_/i },
      orderId: { $not: /^AI_/i }
    };

    const excludeFilter = {
      ...aiExclude,
      userId: { $nin: excludedUserIds },
      astrologerId: { $nin: excludedAstrologerIds }
    };

    const transactionExclude = {
      userId: { $nin: [...excludedUserIds, ...excludedAstrologerIds] },
      orderId: { $not: /^AI_/i },
      sessionId: { $not: /^AI_/i },
      $and: [
        { $or: [{ relatedAstrologerId: { $exists: false } }, { relatedAstrologerId: { $nin: excludedAstrologerIds } }] },
        { $or: [{ relatedUserId: { $exists: false } }, { relatedUserId: { $nin: excludedUserIds } }] }
      ]
    };

    const [
      totalOrders,
      callStats,
      chatStats,
      giftStats,
      bonusUsage,
      penalties
    ] = await Promise.all([
      this.orderModel.countDocuments({ ...excludeFilter }),

      // Call Commissions (Excludes AI calls)
      this.callSessionModel.aggregate([
        { $match: { status: 'ended', ...excludeFilter } },
        { $group: { _id: null, commission: { $sum: '$platformCommission' } } }
      ]),

      // Chat Commissions (Excludes AI chats)
      this.chatSessionModel.aggregate([
        { $match: { status: 'ended', ...excludeFilter } },
        { $group: { _id: null, commission: { $sum: '$platformCommission' } } }
      ]),

      // Gift Commissions
      this.transactionModel.aggregate([
        { 
          $match: { 
            status: 'completed', 
            type: 'gift', 
            userModel: 'User', // Only count the user-side transaction to avoid double counting
            ...transactionExclude 
          } 
        },
        { $group: { _id: null, commission: { $sum: '$platformCommission' } } }
      ]),

      // Bonus Usage (Deductions) - Excludes AI-related transactions
      this.transactionModel.aggregate([
        {
          $match: {
            status: 'completed',
            type: { $in: ['deduction', 'session_payment', 'charge', 'gift'] },
            ...transactionExclude
          }
        },
        { $group: { _id: null, total: { $sum: '$bonusAmount' } } }
      ]),

      // Penalties (Add to Revenue)
      this.astrologerModel.aggregate([
        { $match: { _id: { $nin: excludedAstrologerIds } } },
        { $unwind: '$penalties' },
        { $match: { 'penalties.status': 'applied' } },
        { $group: { _id: null, total: { $sum: '$penalties.amount' } } }
      ])
    ]);

    const grossCommission = (callStats[0]?.commission || 0) + (chatStats[0]?.commission || 0) + (giftStats[0]?.commission || 0);
    const totalPenalties = penalties[0]?.total || 0;
    const bonusDeductions = bonusUsage[0]?.total || 0;

    // Net Revenue = (Commissions + Penalties) - Bonus Usage
    const netRevenue = (grossCommission + totalPenalties) - bonusDeductions;

    return {
      success: true,
      data: {
        totalUsers,
        totalAstrologers,
        totalOrders,
        financials: {
          grossCommission,
          netRevenue,
          bonusDeductions,
          penaltiesCollected: totalPenalties
        }
      },
    };
  }

  /**
   * ✅ GET REVENUE ANALYTICS (ROBUST)
   * Merges multiple data sources and ensures continuous timeline
   */
  async getRevenueAnalytics(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // ✅ Include the full end day

    const [testUserIds, testAstrologerIds] = await Promise.all([
      // Fetch ObjectIDs of designated test accounts to exclude them from platform math
      this.userModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878', '+917347414419', '7347414419', '+916284796246', '6284796246'] } }).select('_id'),
      this.astrologerModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878'] } }).select('_id')
    ]);

    const excludedUserIds = testUserIds.map(u => u._id);
    const excludedAstrologerIds = testAstrologerIds.map(a => a._id);

    const aiExclude = {
      isAi: { $ne: true },
      astrologerModel: { $ne: 'AiAstrologerProfile' },
      sessionId: { $not: /^AI_/i },
      orderId: { $not: /^AI_/i }
    };

    const excludeFilter = {
      ...aiExclude,
      userId: { $nin: excludedUserIds },
      astrologerId: { $nin: excludedAstrologerIds }
    };

    const transactionExclude = {
      userId: { $nin: [...excludedUserIds, ...excludedAstrologerIds] },
      orderId: { $not: /^AI_/i },
      sessionId: { $not: /^AI_/i },
      $and: [
        { $or: [{ relatedAstrologerId: { $exists: false } }, { relatedAstrologerId: { $nin: excludedAstrologerIds } }] },
        { $or: [{ relatedUserId: { $exists: false } }, { relatedUserId: { $nin: excludedUserIds } }] }
      ]
    };

    // 1. Aggregations (Full Code Restored)
    // Excludes AI calls from revenue chart
    const callRevenue = await this.callSessionModel.aggregate([
      {
        $match: {
          status: 'ended',
          ...excludeFilter,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          commission: { $sum: "$platformCommission" },
          count: { $sum: 1 }
        }
      }
    ]);

    const chatRevenue = await this.chatSessionModel.aggregate([
      {
        $match: {
          status: 'ended',
          ...excludeFilter,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          commission: { $sum: "$platformCommission" },
          count: { $sum: 1 }
        }
      }
    ]);

    const giftRevenue = await this.transactionModel.aggregate([
      {
        $match: {
          status: 'completed',
          type: 'gift',
          userModel: 'User', // Avoid double counting (Astrologer and User transactions exist)
          createdAt: { $gte: start, $lte: end },
          ...transactionExclude
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          commission: { $sum: "$platformCommission" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Excludes AI-related transactions from bonus deductions
    const bonusDeductions = await this.transactionModel.aggregate([
      {
        $match: {
          status: 'completed',
          type: { $in: ['deduction', 'session_payment', 'charge', 'gift'] },
          createdAt: { $gte: start, $lte: end },
          ...transactionExclude
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          amount: { $sum: "$bonusAmount" }
        }
      }
    ]);

    // 2. Data Merging Structure
    interface DailyStats {
      date: string;
      gross: number;
      deductions: number;
      net: number;
      orders: number;
    }

    const dateMap = new Map<string, DailyStats>();

    // Helper to initialize day
    const getDayObj = (date: string): DailyStats => {
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, gross: 0, deductions: 0, net: 0, orders: 0 });
      }
      return dateMap.get(date)!;
    };

    // Populate data
    [...callRevenue, ...chatRevenue, ...giftRevenue].forEach(item => {
      if (!item._id) return;
      const obj = getDayObj(item._id);
      obj.gross += item.commission || 0;
      obj.orders += item.count || 0;
    });

    bonusDeductions.forEach(item => {
      if (!item._id) return;
      const obj = getDayObj(item._id);
      obj.deductions += Math.abs(item.amount || 0);
    });

    // 3. Fill Missing Dates (Continuous Timeline)
    const dailyData: DailyStats[] = [];

    // Clone start date to avoid mutation issues
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const data = dateMap.get(dateStr) || { date: dateStr, gross: 0, deductions: 0, net: 0, orders: 0 };

      // Net Calculation
      data.net = data.gross - data.deductions;

      dailyData.push(data);

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return {
      success: true,
      data: dailyData
    };
  }
}