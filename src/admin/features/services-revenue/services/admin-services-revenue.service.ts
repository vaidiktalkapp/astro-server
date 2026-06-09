import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalletTransaction, WalletTransactionDocument } from '../../../../payments/schemas/wallet-transaction.schema';
import { User, UserDocument } from '../../../../users/schemas/user.schema';
import { Astrologer, AstrologerDocument } from '../../../../astrologers/schemas/astrologer.schema';
import { MatrimonyChatOrder, MatrimonyChatOrderDocument } from '../../../../matrimony/schemas/matrimony-chat-order.schema';
import { Report, ReportDocument } from '../../../../reports/schemas/reports.schema';
import { Order, OrderDocument } from '../../../../orders/schemas/orders.schema';

@Injectable()
export class AdminServicesRevenueService {
  private readonly logger = new Logger(AdminServicesRevenueService.name);

  constructor(
    @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(MatrimonyChatOrder.name) private matriOrderModel: Model<MatrimonyChatOrderDocument>,
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  /**
   * Get Quick Stats for Services Revenue
   */
  async getQuickStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [testUserIds] = await Promise.all([
      this.userModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878', '+917347414419', '7347414419', '+916284796246', '6284796246'] } }).select('_id'),
    ]);

    const excludedUserIds = testUserIds.map(u => u._id);
    const filter = { userId: { $nin: excludedUserIds } };

    // 1. PDF Revenue (from wallet transactions)
    const pdfStats = await this.transactionModel.aggregate([
      {
        $match: {
          ...filter,
          status: 'completed',
          $or: [
            { description: { $regex: /PDF Download/i } },
            { description: { $regex: /Tool Purchase/i } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', today] }, '$amount', 0]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // 2. Matrimony Revenue
    const matriStats = await this.matriOrderModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amountPaid' },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', today] }, '$amountPaid', 0]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Reports Revenue (Custom Reports created by Astrologers)
    // We look for orders of type 'report' or similar if they exist, 
    // or we check the Report schema if it has payment info (it doesn't, it has orderId)
    // So we query Orders where type is NOT chat/call/conversation? 
    // Or we look for descriptions matching "Report"
    const reportStats = await this.transactionModel.aggregate([
        {
          $match: {
            ...filter,
            status: 'completed',
            description: { $regex: /Report Purchase|Report Request/i }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            todayRevenue: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', today] }, '$amount', 0]
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);

    return {
      success: true,
      data: {
        pdf: {
          total: pdfStats[0]?.totalRevenue || 0,
          today: pdfStats[0]?.todayRevenue || 0,
          count: pdfStats[0]?.count || 0,
        },
        matrimony: {
          total: matriStats[0]?.totalRevenue || 0,
          today: matriStats[0]?.todayRevenue || 0,
          count: matriStats[0]?.count || 0,
        },
        reports: {
          total: reportStats[0]?.totalRevenue || 0,
          today: reportStats[0]?.todayRevenue || 0,
          count: reportStats[0]?.count || 0,
        },
        combined: {
          total: (pdfStats[0]?.totalRevenue || 0) + (matriStats[0]?.totalRevenue || 0) + (reportStats[0]?.totalRevenue || 0),
          today: (pdfStats[0]?.todayRevenue || 0) + (matriStats[0]?.todayRevenue || 0) + (reportStats[0]?.todayRevenue || 0),
        }
      }
    };
  }

  /**
   * Get Revenue Analytics (Chart Data)
   */
  async getRevenueAnalytics(timeRange: string = 'monthly') {
    const { start, end } = this.getDateRange(timeRange);
    
    const [testUserIds] = await Promise.all([
      this.userModel.find({ phoneNumber: { $in: ['+919873211086', '+917878787878', '9873211086', '7878787878', '+917347414419', '7347414419', '+916284796246', '6284796246'] } }).select('_id'),
    ]);
    const excludedUserIds = testUserIds.map(u => u._id);
    const filter = { 
        userId: { $nin: excludedUserIds },
        createdAt: { $gte: start, $lte: end }
    };

    // Aggregate PDF
    const pdfDaily = await this.transactionModel.aggregate([
        { 
            $match: { 
                ...filter, 
                status: 'completed',
                description: { $regex: /PDF Download|Tool Purchase/i }
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: "$amount" }
            }
        }
    ]);

    // Aggregate Matrimony
    const matriDaily = await this.matriOrderModel.aggregate([
        { $match: filter },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: "$amountPaid" }
            }
        }
    ]);

    // Aggregate Reports
    const reportDaily = await this.transactionModel.aggregate([
        { 
            $match: { 
                ...filter, 
                status: 'completed',
                description: { $regex: /Report Purchase|Report Request/i }
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: "$amount" }
            }
        }
    ]);

    // Merge data
    return this.fillDateGaps(pdfDaily, matriDaily, reportDaily, start, end);
  }

  private getDateRange(timeRange: string) {
    const end = new Date();
    const start = new Date();
    if (timeRange === 'weekly') start.setDate(end.getDate() - 7);
    else if (timeRange === 'monthly') start.setDate(end.getDate() - 30);
    else start.setDate(end.getDate() - 1); // today/daily
    
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  private fillDateGaps(pdf: any[], matri: any[], reports: any[], start: Date, end: Date) {
    const filledData: any[] = [];
    const pdfMap = new Map(pdf.map(i => [i._id, i.revenue]));
    const matriMap = new Map(matri.map(i => [i._id, i.revenue]));
    const reportMap = new Map(reports.map(i => [i._id, i.revenue]));

    const current = new Date(start);
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        filledData.push({
            date: dateStr,
            pdfRevenue: pdfMap.get(dateStr) || 0,
            matriRevenue: matriMap.get(dateStr) || 0,
            reportRevenue: reportMap.get(dateStr) || 0,
            totalRevenue: (pdfMap.get(dateStr) || 0) + (matriMap.get(dateStr) || 0) + (reportMap.get(dateStr) || 0)
        });
        current.setDate(current.getDate() + 1);
    }
    return filledData;
  }
}
