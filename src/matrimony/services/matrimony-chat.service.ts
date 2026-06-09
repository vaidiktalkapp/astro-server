import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MatrimonyMessage, MatrimonyMessageDocument } from '../schemas/matrimony-message.schema';
import { MatrimonyInterest, MatrimonyInterestDocument } from '../schemas/matrimony-interest.schema';
import { MatrimonyChatSettings, MatrimonyChatSettingsDocument } from '../schemas/matrimony-chat-settings.schema';
import { MatrimonyChatOrder, MatrimonyChatOrderDocument } from '../schemas/matrimony-chat-order.schema';
import { WalletService } from '../../payments/services/wallet.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { RefinedNotificationType } from '../../notifications/config/notification-types.config';

@Injectable()
export class MatrimonyChatService {
  private readonly logger = new Logger(MatrimonyChatService.name);

  constructor(
    @InjectModel(MatrimonyMessage.name) private messageModel: Model<MatrimonyMessageDocument>,
    @InjectModel(MatrimonyInterest.name) private interestModel: Model<MatrimonyInterestDocument>,
    @InjectModel(MatrimonyChatSettings.name) private settingsModel: Model<MatrimonyChatSettingsDocument>,
    @InjectModel(MatrimonyChatOrder.name) private orderModel: Model<MatrimonyChatOrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private walletService: WalletService,
    private notificationService: NotificationService,
  ) {}

  // ===== SETTINGS (ADMIN) =====

  async getChatSettings() {
    let settings = await this.settingsModel.findOne({ key: 'global' });
    if (!settings) {
      settings = await this.settingsModel.create({ key: 'global' });
    }
    return settings;
  }

  async updateChatSettings(data: { isEnabled?: boolean; pricingTiers?: any[] }) {
    const settings = await this.settingsModel.findOneAndUpdate(
      { key: 'global' },
      { $set: data },
      { upsert: true, new: true },
    );
    return settings;
  }

  // ===== PURCHASE CHAT QUOTA =====

  async purchaseChatTime(userId: string, interestId: string, tierIndex: number) {
    const settings = await this.getChatSettings();

    if (!settings.isEnabled) {
      throw new BadRequestException('Matrimony Chat is currently disabled.');
    }

    const tier = settings.pricingTiers[tierIndex];
    if (!tier) {
      throw new BadRequestException('Invalid pricing tier selected.');
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(interestId)) {
        throw new BadRequestException('Invalid User OR Match ID format.');
    }

    // Verify this is a valid accepted match
    const interest = await this.interestModel.findById(interestId);
    if (!interest) {
      throw new BadRequestException('Match record not found. Please go back to the profile and try again.');
    }
    if (interest.status !== 'accepted') {
      throw new BadRequestException('You can only chat with accepted matches.');
    }

    // Verify user is part of this match
    const senderIdStr = interest.senderId.toString();
    const receiverIdStr = interest.receiverId.toString();
    const requestingUserIdStr = userId.toString();
    
    if (senderIdStr !== requestingUserIdStr && receiverIdStr !== requestingUserIdStr) {
      this.logger.error(`❌ Participant check failed for user: ${requestingUserIdStr}. Interest ${interestId} has sender: ${senderIdStr} and receiver: ${receiverIdStr}`);
      throw new BadRequestException('You are not a participant in this match.');
    }

    // Deduct from wallet (uses isolated VaidikTalk wallet logic)
    await this.walletService.deductForMatrimonyChat(userId, tier.price, interestId);

    // Create the order / Add to existing active order if any
    let activeOrder = await this.getActiveOrder(userId, interestId);

    if (activeOrder) {
      // Top up existing order
      activeOrder.totalMessages += tier.messageCount;
      activeOrder.amountPaid += tier.price;
      await activeOrder.save();
    } else {
      // Create new order
      activeOrder = await this.orderModel.create({
        userId: new Types.ObjectId(userId),
        interestId: new Types.ObjectId(interestId),
        totalMessages: tier.messageCount,
        messagesUsed: 0,
        amountPaid: tier.price,
        status: 'active',
      });
    }

    this.logger.log(`✅ Matrimony Chat purchased: User ${userId} paid ₹${tier.price} for ${tier.messageCount} messages in match ${interestId}`);

    return {
      orderId: activeOrder._id,
      totalMessages: activeOrder.totalMessages,
      messagesUsed: activeOrder.messagesUsed,
      remainingMessages: activeOrder.totalMessages - activeOrder.messagesUsed,
      amountPaid: tier.price,
    };
  }

  // ===== CHECK ACTIVE ORDER =====

  async getActiveOrder(userId: string, interestId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(interestId)) {
        return null;
    }
    // Look for active order where used < total
    const order = await this.orderModel.findOne({
      userId: new Types.ObjectId(userId),
      interestId: new Types.ObjectId(interestId),
      status: 'active',
      $expr: { $lt: ['$messagesUsed', '$totalMessages'] }
    });

    return order;
  }

  // ===== SEND MESSAGE (WITH PAID CHECK) =====

  async sendMessage(interestId: string, senderId: string, content: string) {
    const interest = await this.interestModel.findById(interestId);
    if (!interest) {
      throw new BadRequestException('Match not found.');
    }
    if (interest.status !== 'accepted') {
      throw new BadRequestException('You can only message accepted matches.');
    }

    const senderObjectId = new Types.ObjectId(senderId);
    let receiverId: Types.ObjectId;

    const senderIdStr = interest.senderId.toString();
    const receiverIdStr = interest.receiverId.toString();
    const requestingSenderIdStr = senderId.toString();

    if (senderIdStr === requestingSenderIdStr) {
      receiverId = interest.receiverId;
    } else if (receiverIdStr === requestingSenderIdStr) {
      receiverId = interest.senderId;
    } else {
      throw new BadRequestException('You are not a participant in this match.');
    }

    const settings = await this.getChatSettings();

    // Sender must have an active order with remaining quota ONLY if the feature is actually enabled
    if (settings.isEnabled) {
      const senderOrder = await this.getActiveOrder(senderId, interestId);
      if (!senderOrder) {
        throw new BadRequestException('QUOTA_EXHAUSTED');
      }
      
      // Deduct quota
      senderOrder.messagesUsed += 1;
      if (senderOrder.messagesUsed >= senderOrder.totalMessages) {
        senderOrder.status = 'exhausted';
      }
      await senderOrder.save();
    }

    // Record the message
    const newMessage = await this.messageModel.create({
      interestId: interest._id,
      senderId: senderObjectId,
      receiverId,
      content,
      status: 'sent',
      sentAt: new Date(),
    });

    // 🚀 Trigger Notification for Receiver (Non-blocking)
    try {
      const sender = await this.userModel.findById(senderId).select('name profileImage').lean();
      
      this.notificationService.sendNotification({
        recipientId: receiverId.toString(),
        recipientModel: 'User',
        type: RefinedNotificationType.MATRIMONY_MESSAGE,
        title: sender?.name ? `New message from ${sender.name}` : 'New Matrimony Message',
        message: content.length > 50 ? `${content.substring(0, 47)}...` : content,
        data: {
          interestId: interest._id.toString(),
          senderId: senderId.toString(),
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        imageUrl: sender?.profileImage,
      }).catch(err => this.logger.error(`❌ Failed to send message notification to ${receiverId}: ${err.message}`));
    } catch (notifErr) {
      this.logger.error(`❌ Notification lookup failed: ${notifErr.message}`);
    }

    return {
      message: newMessage,
      remainingMessages: settings.isEnabled ? await this.getRemainingMessages(senderId, interestId) : 9999
    };
  }

  // Helper to get raw remaining messages
  private async getRemainingMessages(userId: string, interestId: string) {
    const order = await this.getActiveOrder(userId, interestId);
    return order ? order.totalMessages - order.messagesUsed : 0;
  }

  // ===== CHAT HISTORY (WITH BLUR CHECK) =====

  async getChatHistory(userId: string, interestId: string, page: number = 1, limit: number = 50): Promise<any> {
    const skip = (page - 1) * limit;
    const settings = await this.getChatSettings();
    
    // Check if the current requesting user has ever bought a pack for this match
    // If the system is DISABLED globally, everyone has automatically 'unlocked' it.
    let hasUnlocked = !settings.isEnabled;

    if (settings.isEnabled) {
      if (Types.ObjectId.isValid(userId) && Types.ObjectId.isValid(interestId)) {
        hasUnlocked = !!(await this.orderModel.exists({
          userId: new Types.ObjectId(userId),
          interestId: new Types.ObjectId(interestId)
        }));
      }
    }

    if (!Types.ObjectId.isValid(interestId)) {
        return { messages: [], hasUnlocked: false, remainingMessages: 0 };
    }

    let messages = await this.messageModel
      .find({ interestId: new Types.ObjectId(interestId) })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    
    messages = messages.reverse();

    // Map through messages and blur incoming ones if not unlocked
    const currentUserIdStr = userId.toString();
    const processedMessages = messages.map(msg => {
      // If the user hasn't paid, and the message was NOT sent by them, blur it.
      if (!hasUnlocked && msg.senderId.toString() !== currentUserIdStr) {
        return { ...msg, content: '•••••••••••••••••••••••••••••', isBlurred: true };
      }
      return { ...msg, isBlurred: false };
    });

    // Also return their current quota remaining if they have an active order
    let remainingMessages = 0;
    const activeOrder = await this.getActiveOrder(userId, interestId);
    if (activeOrder) {
      remainingMessages = activeOrder.totalMessages - activeOrder.messagesUsed;
    }

    return {
      messages: processedMessages,
      hasUnlocked: !!hasUnlocked,
      remainingMessages
    };
  }

  async markAsRead(interestId: string, readerId: string) {
    if (!Types.ObjectId.isValid(interestId) || !Types.ObjectId.isValid(readerId)) {
        return;
    }
    await this.messageModel.updateMany(
      {
        interestId: new Types.ObjectId(interestId),
        receiverId: new Types.ObjectId(readerId),
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } },
    );
  }

  // ===== ADMIN: ALL CONVERSATIONS =====

  async getAllConversationsForAdmin(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const conversations = await this.interestModel.aggregate([
      { $match: { status: 'accepted' } },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'senderId',
          foreignField: '_id',
          as: 'sender',
        },
      },
      { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'receiverId',
          foreignField: '_id',
          as: 'receiver',
        },
      },
      { $unwind: { path: '$receiver', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'matrimony_messages',
          localField: '_id',
          foreignField: 'interestId',
          as: 'messages',
        },
      },
      {
        $addFields: {
          messageCount: { $size: '$messages' },
          lastMessage: { $arrayElemAt: [{ $sortArray: { input: '$messages', sortBy: { sentAt: -1 } } }, 0] },
        },
      },
      {
        $project: {
          messages: 0,
          'sender.wallet': 0,
          'sender.password': 0,
          'receiver.wallet': 0,
          'receiver.password': 0,
        },
      },
    ]);

    const total = await this.interestModel.countDocuments({ status: 'accepted' });

    return {
      conversations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ===== ADMIN: READ CHAT MESSAGES =====

  async getChatMessagesForAdmin(interestId: string) {
    const messages = await this.messageModel
      .find({ interestId: new Types.ObjectId(interestId) })
      .populate('senderId', 'name profileImage')
      .populate('receiverId', 'name profileImage')
      .sort({ sentAt: 1 })
      .exec();
    return messages;
  }

  // ===== ADMIN: CHAT ORDERS / REVENUE =====

  async getChatOrdersForAdmin(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.orderModel
        .find()
        .populate('userId', 'name phoneNumber profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(),
    ]);

    const totalRevenue = await this.orderModel.aggregate([
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]);

    return {
      orders,
      total,
      totalRevenue: totalRevenue[0]?.total || 0,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCountsForInterests(userId: string, interestIds: string[]) {
    if (!interestIds || interestIds.length === 0) return {};

    const objIds = interestIds.map(id => new Types.ObjectId(id));
    const counts = await this.messageModel.aggregate([
      {
        $match: {
          interestId: { $in: objIds },
          receiverId: new Types.ObjectId(userId),
          status: { $ne: 'read' },
        },
      },
      {
        $group: {
          _id: '$interestId',
          unreadCount: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {};
    counts.forEach(c => {
      result[c._id.toString()] = c.unreadCount;
    });
    return result;
  }
}
