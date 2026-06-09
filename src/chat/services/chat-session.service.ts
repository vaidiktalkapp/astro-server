// src/chat/services/chat-session.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSession, ChatSessionDocument } from '../schemas/chat-session.schema';
import { OrdersService } from '../../orders/services/orders.service';
import { OrderPaymentService } from '../../orders/services/order-payment.service';
import { WalletService } from '../../payments/services/wallet.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Astrologer, AstrologerDocument } from '../../astrologers/schemas/astrologer.schema';
import { EarningsService } from '../../astrologers/services/earnings.service';
import { PenaltyService } from '../../astrologers/services/penalty.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { AstrologerBlockingService } from '../../astrologers/services/astrologer-blocking.service';
import { UserBlockingService } from 'src/users/services/user-blocking.service';
import { AvailabilityService } from '../../astrologers/services/availability.service';
import { SystemSettings, SystemSettingsDocument } from '../../payments/schemas/system-settings.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  private joinTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(SystemSettings.name) private systemSettingsModel: Model<SystemSettingsDocument>,
    private ordersService: OrdersService,
    private orderPaymentService: OrderPaymentService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private notificationService: NotificationService,
    private earningsService: EarningsService,
    private penaltyService: PenaltyService,
    private blockingService: AstrologerBlockingService,
    private userBlockingService: UserBlockingService,
    private availabilityService: AvailabilityService,
  ) { }

  private generateSessionId(): string {
    return `CHAT_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
  }

  private toObjectId(id: string): Types.ObjectId {
    try {
      return new Types.ObjectId(id);
    } catch {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // ===== INITIATE CHAT =====
  async initiateChat(sessionData: {
    userId: string;
    astrologerId: string;
    astrologerName: string;
    ratePerMinute: number;
    profileId?: string;
  }): Promise<any> {
    const isBlocked = await this.blockingService.isUserBlocked(sessionData.astrologerId, sessionData.userId);
    if (isBlocked) {
      throw new BadRequestException('You have been blocked by this astrologer.');
    }

    // ✅ AUTO-CLEANUP: Cancel stale sessions stuck in initiated/waiting for 5+ minutes
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    await this.sessionModel.updateMany(
      {
        userId: this.toObjectId(sessionData.userId),
        status: { $in: ['initiated', 'waiting', 'waiting_in_queue'] },
        createdAt: { $lt: staleThreshold }
      },
      {
        $set: {
          status: 'cancelled',
          endReason: 'stale_session_cleanup',
          endTime: new Date()
        }
      }
    );

    // ✅ PREVENT DOUBLE CHATS: Check if user already has an active/pending session
    const existingSession = await this.sessionModel.findOne({
      userId: this.toObjectId(sessionData.userId),
      status: { $in: ['initiated', 'waiting', 'waiting_in_queue', 'active'] }
    });

    if (existingSession) {
      this.logger.warn(`Found existing chat session: ${existingSession.sessionId} for user ${sessionData.userId}`);
      throw new BadRequestException('You already have an active chat request. Please wait or end it before starting a new one.');
    }

    // ✅ PREVENT DOUBLE BOOKING: Strict check against astrologer's Real-Time Availability
    const isAvailable = await this.availabilityService.isAvailableNow(sessionData.astrologerId, sessionData.userId);
    if (!isAvailable) {
      throw new BadRequestException('Astrologer is currently busy or offline. Please try again later.');
    }
    const isAstrologerBlocked = await this.userBlockingService.isAstrologerBlocked(this.toObjectId(sessionData.userId), sessionData.astrologerId);
    if (isAstrologerBlocked) {
      throw new BadRequestException('You have blocked this astrologer. Unblock them to continue.');
    }
    const estimatedCost = sessionData.ratePerMinute * 5;
    const hasBalance = await this.walletService.checkBalance(
      sessionData.userId,
      estimatedCost
    );

    if (!hasBalance) {
      throw new BadRequestException(
        `Insufficient balance. Minimum ₹${estimatedCost} required to start chat.`
      );
    }

    const sessionId = this.generateSessionId();
    console.log(sessionId, 'generated session id');

    // ✅ STEP 1: Find or create conversation thread (returns existing order!)
    const conversationThread = await this.ordersService.findOrCreateConversationThread(
      sessionData.userId,
      sessionData.astrologerId,
      sessionData.astrologerName,
      sessionData.ratePerMinute
    );

    this.logger.log(`Using conversation thread: ${conversationThread.orderId}`);

    // ✅ STEP 2: Create order for this session (updates conversation thread)
    const order = await this.ordersService.createOrder({
      userId: sessionData.userId,
      astrologerId: sessionData.astrologerId,
      astrologerName: sessionData.astrologerName,
      type: 'chat',
      ratePerMinute: sessionData.ratePerMinute,
      sessionId: sessionId
    });

    if (!order || !order.orderId) {
      this.logger.error('Order creation failed');
      throw new Error('Order creation failed');
    }

    this.logger.log(`Order reference: ${order.orderId}`);

    // ✅ STEP 3: Calculate session number (how many chats in this thread?)
    const sessionNumber = order.sessionHistory.filter(s => s.sessionType === 'chat').length + 1;

    // FETCH USER AND SAVED PROFILE IF SPECIFIED
    const userData = await this.userModel.findById(sessionData.userId).select('name profileImage savedProfiles').lean();
    const userName = userData?.name || 'User';
    const userProfilePic = userData?.profileImage || '';

    let intakeProfile: any = undefined;
    if (sessionData.profileId && userData?.savedProfiles) {
      const selectedProfile = userData.savedProfiles.find(
        (p: any) => p._id.toString() === sessionData.profileId
      );
      if (selectedProfile) {
        intakeProfile = {
          name: selectedProfile.name,
          gender: selectedProfile.gender,
          dateOfBirth: selectedProfile.dateOfBirth,
          timeOfBirth: selectedProfile.timeOfBirth,
          placeOfBirth: selectedProfile.placeOfBirth,
          lat: selectedProfile.lat,
          lon: selectedProfile.lon,
          maritalStatus: selectedProfile.maritalStatus,
          occupation: selectedProfile.occupation,
          relation: selectedProfile.relation
        };
      }
    }

    // ✅ STEP 4: Create chat session linked to conversation thread
    const session = new this.sessionModel({
      sessionId,
      userId: this.toObjectId(sessionData.userId),
      astrologerId: this.toObjectId(sessionData.astrologerId),
      astrologerModel: 'Astrologer',
      orderId: order.orderId, // conversation thread orderId
      conversationThreadId: order.conversationThreadId,
      sessionNumber,
      ratePerMinute: sessionData.ratePerMinute,
      status: 'initiated',
      requestCreatedAt: new Date(),
      ringTime: new Date(),
      maxDurationMinutes: 0,
      maxDurationSeconds: 0,
      timerStatus: 'not_started',
      timerMetrics: {
        elapsedSeconds: 0,
        remainingSeconds: 0
      },
      intakeProfile // Store overriding profile details
    });

    await session.save();

    // Set 3-min timeout
    this.setRequestTimeout(sessionId, order.orderId, sessionData.userId);

    // ✅ MARK BUSY IMMEDIATELY: Show as busy in list while request is pending
    await this.availabilityService.setBusy(sessionData.astrologerId, new Date(Date.now() + 3 * 60 * 1000));

    // ✅ Fire-and-forget notification to astrologer
    // ✅ Notify astrologer (incoming chat request) – type MUST be "chat_request"
    this.notificationService.sendNotification({
      recipientId: sessionData.astrologerId,
      recipientModel: 'Astrologer',
      type: 'chat_request', // matches astrologer app getNotificationConfig
      title: 'New chat request',
      message: 'You have a new chat request from a user.',
      data: {
        type: 'chat_request',            // so app sees data.type correctly
        mode: 'chat',
        sessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        userId: sessionData.userId,
        userName: intakeProfile?.name || userName,
        userProfilePic,
        astrologerId: sessionData.astrologerId,
        ratePerMinute: sessionData.ratePerMinute,
        step: 'user_initiated',
        fullScreen: 'true',
        profile: intakeProfile ? {
          name: intakeProfile.name,
          gender: intakeProfile.gender,
          dateOfBirth: intakeProfile.dateOfBirth,
          timeOfBirth: intakeProfile.timeOfBirth,
          placeOfBirth: intakeProfile.placeOfBirth,
          // relation: intakeProfile.relation,
        } : undefined,
      },
      priority: 'high',
    }).catch(err =>
      this.logger.error(`Chat incoming notification error: ${err.message}`),
    );


    this.logger.log(
      `Chat initiated: ${sessionId} | Thread: ${order.conversationThreadId} | Session #${sessionNumber}`,
    );

    return {
      success: true,
      message: 'Chat initiated - waiting for astrologer',
      data: {
        sessionId: session.sessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        sessionNumber,
        status: 'initiated',
        ratePerMinute: sessionData.ratePerMinute
      }
    };
  }

  // ===== ACCEPT CHAT =====
  async acceptChat(sessionId: string, astrologerId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'initiated') {
      throw new BadRequestException('Session not in initiated state');
    }

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    session.status = 'waiting';
    session.acceptedAt = new Date();
    await session.save();

    // ✅ Temporarily mark as busy for 2 minutes while user joins
    await this.availabilityService.setBusy(astrologerId, new Date(Date.now() + 2 * 60 * 1000));

    // 🆕 Start 60s join timeout for user
    this.setUserJoinTimeout(sessionId);

    const astrologerData = await this.astrologerModel.findById(astrologerId).select('name profilePicture').lean();
    const astrologerName = astrologerData?.name || 'Astrologer';
    const astrologerImage = astrologerData?.profilePicture || '';

    // Notify user that astrologer accepted
    // Notify user that astrologer accepted – use "request_accepted"
    this.notificationService.sendNotification({
      recipientId: session.userId.toString(),
      recipientModel: 'User',
      type: 'request_accepted',
      title: 'Astrologer accepted your chat',
      message: 'Tap to start your chat session.',
      data: {
        mode: 'chat',
        sessionId: session.sessionId,
        orderId: session.orderId,
        astrologerId,
        astrologerName,
        astrologerImage,
        ratePerMinute: session.ratePerMinute,
      },
      priority: 'high',
    }).catch(err =>
      this.logger.error(`Chat accepted notification error: ${err.message}`),
    );


    this.logger.log(`Chat accepted: ${sessionId}`);

    if (this.chatGateway && typeof this.chatGateway.notifyUserOfAcceptance === 'function') {
      this.chatGateway.notifyUserOfAcceptance(sessionId, astrologerId)
        .catch(err => this.logger.error(`Failed to emit chat_accepted socket: ${err.message}`));
    }

    return {
      success: true,
      message: 'Chat accepted',
      status: 'waiting',
      data: {
        orderId: session.orderId,
        userId: session.userId,
      }
    };
  }

  // ===== REJECT CHAT =====
  async rejectChat(
    sessionId: string,
    astrologerId: string,
    reason: string
  ): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'cancelled' || session.status === 'rejected') {
      // ✅ SUCCESS: No penalty if already cancelled/rejected
      return { success: true, message: 'Chat already cancelled or rejected' };
    }

    if (session.status !== 'initiated' && session.status !== 'waiting') {
      throw new BadRequestException('Session cannot be rejected at this stage');
    }

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    session.status = 'rejected';
    session.endedBy = astrologerId;
    session.endReason = 'astrologer_rejected';
    session.endTime = new Date();
    await session.save();

    // ✅ Clear busy status since the chat was rejected
    await this.availabilityService.setAvailable(astrologerId);

    // ✅ NEW: Apply penalty for rejection
    try {
      await this.penaltyService.applyPenalty({
        astrologerId,
        type: 'missed_appointment',
        amount: 20, // ₹20 penalty for rejecting chat
        reason: 'Chat request rejected',
        description: 'Rejected chat request from user',
        orderId: session.orderId,
        userId: session.userId.toString(),
        appliedBy: 'system',
      });
      this.logger.log(`✅ Penalty applied: ₹20 to astrologer ${astrologerId} for rejecting chat`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to apply penalty: ${error.message}`);
    }

    // Update order (no wallet logic here)
    try {
      await this.ordersService.cancelOrder(
        session.orderId,
        session.userId.toString(),
        reason,
        'astrologer'
      );
    } catch (e: any) {
      this.logger.error(`❌ Failed to cancel order during chat rejection: ${e.message}`);
    }

    // Notify user that astrologer rejected – use "request_rejected"
    this.notificationService.sendNotification({
      recipientId: session.userId.toString(),
      recipientModel: 'User',
      type: 'request_rejected',
      title: 'Chat request rejected',
      message: 'Astrologer rejected your chat request. No amount has been charged.',
      data: {
        type: 'request_rejected',
        mode: 'chat',
        sessionId: session.sessionId,
        orderId: session.orderId,
        astrologerId,
        step: 'astrologer_rejected',
      },
      priority: 'medium',
    }).catch(err =>
      this.logger.error(`Chat rejected notification error: ${err.message}`),
    );


    this.logger.log(`Chat rejected: ${sessionId}`);

    if (this.chatGateway && typeof this.chatGateway.notifyUserOfRejection === 'function') {
      this.chatGateway.notifyUserOfRejection(sessionId, astrologerId, reason)
        .catch(err => this.logger.error(`Failed to emit chat_rejected socket: ${err.message}`));
    }

    return {
      success: true,
      message: 'Chat rejected'
    };
  }

  // ===== CANCEL CHAT (USER INITIATED) =====
  async cancelChat(sessionId: string, userId: string, reason: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'initiated' && session.status !== 'waiting') {
      // If already active or ended, use endSession instead
      return { success: false, message: `Session cannot be cancelled at stage: ${session.status}` };
    }

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    session.status = 'cancelled';
    session.endedBy = userId;
    session.endReason = reason || 'user_cancelled';
    session.endTime = new Date();
    await session.save();

    // ✅ RESET AVAILABILITY
    await this.availabilityService.setAvailable(session.astrologerId.toString());

    try {
      await this.ordersService.cancelOrder(session.orderId, session.userId.toString(), reason, 'user');
    } catch (e: any) {
      this.logger.error(`❌ Failed to cancel order during chat cancellation: ${e.message}`);
    }

    this.logger.log(`Chat request cancelled by user: ${sessionId}`);
    return { success: true, message: 'Chat request cancelled' };
  }

  // ===== START SESSION (with Kundli message) =====
  async startSession(sessionId: string, userId?: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'waiting' && session.status !== 'waiting_in_queue') {
      this.logger.warn(`Session ${sessionId} is in status ${session.status}, cannot start`);
      throw new BadRequestException('Session not in valid state to start');
    }

    // Calculate max duration
    const walletBalance = await this.walletService.getBalance(session.userId.toString());
    const maxDurationMinutes = Math.floor(walletBalance / session.ratePerMinute);
    const maxDurationSeconds = maxDurationMinutes * 60;

    if (maxDurationMinutes < 1) {
      throw new BadRequestException('Insufficient balance to start chat');
    }

    // ✅ UPDATE SESSION STATUS TO ACTIVE
    session.status = 'active';
    session.startTime = new Date();
    session.maxDurationMinutes = maxDurationMinutes;
    session.maxDurationSeconds = maxDurationSeconds;
    session.timerStatus = 'running';
    session.timerMetrics.elapsedSeconds = 0;
    session.timerMetrics.remainingSeconds = maxDurationSeconds;
    session.timerMetrics.lastUpdatedAt = new Date();

    // ✅ Set accurate Wait Time for the User App
    const busyUntil = new Date(Date.now() + maxDurationSeconds * 1000);
    await this.availabilityService.setBusy(session.astrologerId.toString(), busyUntil);

    await session.save();
    this.clearUserJoinTimeout(sessionId);
    this.logger.log(`✅ Session ${sessionId} status updated to ACTIVE`);

    // ✅ UPDATE ORDER STATUS TO ACTIVE
    await this.ordersService.updateOrderStatus(session.orderId, 'active');
    this.logger.log(`✅ Order ${session.orderId} status updated to ACTIVE`);

    return {
      success: true,
      message: 'Chat session started',
      data: {
        status: 'active',
        maxDurationMinutes,
        maxDurationSeconds,
        ratePerMinute: session.ratePerMinute,
        sendKundliMessage: true
      }
    };
  }

  /**
 * Get astrologer's chat sessions
 */
  async getAstrologerChatSessions(
    astrologerId: string,
    filters: {
      page: number;
      limit: number;
      status?: string;
    }
  ): Promise<any> {
    const query: any = {
      astrologerId: this.toObjectId(astrologerId)
    };

    if (filters.status) {
      query.status = filters.status;
    }

    const skip = (filters.page - 1) * filters.limit;

    // ✅ FIXED: Added 'lastMessage', 'lastMessageAt', and 'orderId' to select so list shows previews and navigation works
    const [sessions, total] = await Promise.all([
      this.sessionModel
        .find(query)
        .populate('userId', 'name profileImage phoneNumber')
        .select('sessionId orderId userId ratePerMinute status duration billedMinutes totalAmount startTime endTime createdAt messageCount lastMessage lastMessageAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      this.sessionModel.countDocuments(query)
    ]);

    return {
      success: true,
      data: {
        sessions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages: Math.ceil(total / filters.limit)
        }
      }
    };
  }

  /**
   * Get astrologer chat session details
   */
  async getAstrologerChatSessionDetails(
    sessionId: string,
    astrologerId: string
  ): Promise<any> {
    const session = await this.sessionModel
      .findOne({
        sessionId,
        astrologerId: this.toObjectId(astrologerId)
      })
      // ✅ FIXED: Included Kundli details (gender, DOB, time, place)
      .populate('userId', 'name profileImage phoneNumber email gender dateOfBirth placeOfBirth timeOfBirth')
      .lean();

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    // Override kundli details if an intake profile was selected
    if (session.intakeProfile && session.userId) {
      const userObj = session.userId as any;
      userObj.name = session.intakeProfile.name;
      userObj.gender = session.intakeProfile.gender;
      userObj.dateOfBirth = session.intakeProfile.dateOfBirth;
      userObj.timeOfBirth = session.intakeProfile.timeOfBirth;
      userObj.placeOfBirth = session.intakeProfile.placeOfBirth;
    }

    // ✅ FIXED: Return data directly to match Call structure
    return {
      success: true,
      data: session
    };
  }

  async getLatestSessionForOrder(orderId: string): Promise<any> {
    const session = await this.sessionModel
      .findOne({ orderId })
      .sort({ createdAt: -1 })
      .lean();
    
    return session;
  }

  // ===== END SESSION =====
  /**
 * END SESSION
 */
  async endSession(sessionId: string, endedBy: string, reason: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'ended') {
      this.logger.warn(`⚠️ Session ${sessionId} already ended, returning existing data`);
      return {
        success: true,
        message: 'Session already ended',
        data: {
          sessionId,
          actualDuration: session.duration || 0,
          billedMinutes: session.billedMinutes || 0,
          chargeAmount: session.totalAmount || 0,
          status: 'ended',
        },
      };
    }

    // Clear timeout
    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    this.clearUserJoinTimeout(sessionId);

    let actualDurationSeconds = 0;

    if (session.status === 'active' && session.startTime) {
      const endTime = new Date();
      actualDurationSeconds = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

      // Cap to max duration to prevent overcharging (even if ended manually after timeout)
      if (actualDurationSeconds > session.maxDurationSeconds) {
        actualDurationSeconds = session.maxDurationSeconds;
      }

      session.duration = actualDurationSeconds;
      session.billedMinutes = Math.ceil(actualDurationSeconds / 60);
      session.totalAmount = session.billedMinutes * session.ratePerMinute;

      let commissionRate = 50;
      const astrologer = await this.astrologerModel.findById(session.astrologerId);
      if (astrologer && astrologer.earnings && typeof astrologer.earnings.platformCommissionRate === 'number') {
        commissionRate = astrologer.earnings.platformCommissionRate;
      } else {
        const settings = await this.systemSettingsModel.findOne();
        if (settings && typeof settings.defaultPlatformCommissionRate === 'number') {
          commissionRate = settings.defaultPlatformCommissionRate;
        }
      }
      session.platformCommission = (session.totalAmount * commissionRate) / 100;
      session.astrologerEarning = session.totalAmount - session.platformCommission;
    }

    // ✅ WALLET DEDUCTION (User) & ASTROLOGER CREDIT
    if (actualDurationSeconds > 0 && session.totalAmount > 0) {
      try {
        // GET USER AND ASTROLOGER DETAILS
        const [user, astrologer] = await Promise.all([
          this.userModel.findById(session.userId).select('name').lean(),
          this.astrologerModel.findById(session.astrologerId).select('name').lean(),
        ]);

        // ✅ USE UNIFIED PAYMENT METHOD
        const paymentResult = await this.walletService.processSessionPayment({
          userId: session.userId.toString(),
          astrologerId: session.astrologerId.toString(),
          amount: session.totalAmount,
          orderId: session.orderId,
          sessionId: session.sessionId,
          sessionType: 'chat',
          userName: user?.name || 'User',
          astrologerName: astrologer?.name || 'Astrologer',
          durationMinutes: session.billedMinutes,
        });

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment failed');
        }

        this.logger.log(`✅ User wallet charged: User(${session.userId}) | Amount: ₹${session.totalAmount}`);
        this.logger.log(`✅ Astrologer credited: ${session.astrologerId} | Amount: ₹${session.astrologerEarning}`);

        // ✅ UPDATE ASTROLOGER EARNINGS (using EarningsService)
        await this.earningsService.updateEarnings(
          session.astrologerId.toString(),
          session.totalAmount,
          'chat',
          session.billedMinutes,
          session.astrologerEarning,
          session.platformCommission,
        );

        session.isPaid = true;
      } catch (error: any) {
        this.logger.error(`❌ Payment processing failed for chat session ${sessionId}: ${error.message}`);
        session.isPaid = false;
      }
    }

    session.status = 'ended';
    session.endTime = new Date();
    session.endedBy = endedBy;
    session.endReason = reason;
    session.timerStatus = 'ended';

    const now = new Date();
    session.postSessionWindowEndsAt = new Date(now.getTime() + 20 * 1000);

    await session.save();

    // ✅ Clear busy status since the chat ended
    await this.availabilityService.setAvailable(session.astrologerId.toString());

    // ONLY complete order if session was active, otherwise cancel
    if (actualDurationSeconds > 0) {
      await this.ordersService.completeSession(session.orderId, {
        sessionId: sessionId,
        sessionType: 'chat',
        actualDurationSeconds: actualDurationSeconds,
        billedMinutes: session.billedMinutes,
        chargedAmount: session.totalAmount,
        recordingUrl: undefined,
        recordingS3Key: undefined,
        recordingDuration: undefined,
        endedBy: session.endedBy,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    } else {
      this.logger.log(`Session ${sessionId} never started (0 duration), updating order with cancelled session`);

      // ✅ FIX: For conversation threads, just update session history, don't cancel entire order
      try {
        await this.ordersService.completeSession(session.orderId, {
          sessionId: sessionId,
          sessionType: 'chat',
          actualDurationSeconds: 0,
          billedMinutes: 0,
          chargedAmount: 0,
          recordingUrl: undefined,
          recordingS3Key: undefined,
          recordingDuration: undefined,
          endedBy: session.endedBy,
          startTime: session.startTime || session.createdAt,
          endTime: session.endTime || new Date(),
        });
      } catch (error: any) {
        this.logger.error(`Failed to update order session history: ${error.message}`);
      }
    }

    this.logger.log(`Chat session ended: ${sessionId} | Duration: ${actualDurationSeconds}s`);

    // ✅ CRITICAL FIX: ADD RETURN STATEMENT
    return {
      success: true,
      message: 'Chat session ended',
      data: {
        sessionId,
        actualDuration: actualDurationSeconds,
        billedMinutes: session.billedMinutes,
        chargeAmount: session.totalAmount,
        status: 'ended',
      },
    };
  }

  // ===== REQUEST TIMEOUT (3 mins) =====
  private setRequestTimeout(sessionId: string, orderId: string, userId: string) {
    const timeout = setTimeout(async () => {
      try {
        const session = await this.sessionModel.findOne({ sessionId });
        if (!session || (session.status !== 'initiated' && session.status !== 'waiting')) {
          return;
        }

        session.status = 'cancelled';
        session.endReason = 'astrologer_no_response';
        session.endTime = new Date();
        await session.save();

        // ✅ Clear busy status since the chat was cancelled by timeout
        await this.availabilityService.setAvailable(session.astrologerId.toString());

        // ✅ NEW: Apply penalty for no response
        try {
          await this.penaltyService.applyPenalty({
            astrologerId: session.astrologerId.toString(),
            type: 'late_response',
            amount: 20, // ₹20 penalty for not responding
            reason: 'No response to chat request',
            description: 'Did not respond to chat request within 3 minutes',
            orderId: session.orderId,
            userId: session.userId.toString(),
            appliedBy: 'system',
          });
          this.logger.log(`✅ Penalty applied: ₹20 to astrologer for no response`);
        } catch (error: any) {
          this.logger.error(`❌ Failed to apply penalty: ${error.message}`);
        }

        // Update order (this will send a timeout notification with "no charge" wording)
        await this.ordersService.handleOrderTimeout(orderId);

        this.logger.log(`Chat request timeout: ${sessionId}`);
        this.sessionTimers.delete(sessionId);
      } catch (error: any) {
        this.logger.error(`Timeout handler error for ${sessionId}: ${error.message}`);
      }
    }, 3 * 60 * 1000);

    this.sessionTimers.set(sessionId, timeout);
  }

  // ===== AUTO-SWEEP STALE SESSIONS (CRON JOB) =====
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleSessions() {
    try {
      const activeSessions = await this.sessionModel.find({ status: 'active' });
      const now = new Date();

      for (const session of activeSessions) {
        if (session.startTime && session.maxDurationSeconds > 0) {
          const elapsedSeconds = Math.floor((now.getTime() - session.startTime.getTime()) / 1000);
          
          // Allow 15 seconds grace period
          if (elapsedSeconds > session.maxDurationSeconds + 15) {
            this.logger.warn(`🧹 [Cron] Terminating stale chat session ${session.sessionId}. Elapsed: ${elapsedSeconds}s, Max: ${session.maxDurationSeconds}s`);
            
            await this.endSession(session.sessionId, 'system', 'timeout');

            // Emit socket events to notify clients to close screens
            if (this.chatGateway && typeof this.chatGateway.server !== 'undefined') {
              this.chatGateway.server.to(session.sessionId).emit('timer_ended', {
                sessionId: session.sessionId,
                reason: 'max_duration_reached',
                timestamp: new Date()
              });
              this.chatGateway.server.to(session.sessionId).emit('chat_ended', {
                sessionId: session.sessionId,
                reason: 'timeout'
              });
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ [Cron] Error in handleStaleSessions (Chat): ${error.message}`);
    }
  }

  // ===== AUTO-END TIMER =====
  private setAutoEndTimer(sessionId: string, maxDurationSeconds: number) {
    const timeout = setTimeout(async () => {
      try {
        await this.endSession(sessionId, 'system', 'timeout');
        this.sessionTimers.delete(sessionId);
      } catch (error: any) {
        this.logger.error(`Auto-end error for ${sessionId}: ${error.message}`);
      }
    }, maxDurationSeconds * 1000);

    this.sessionTimers.set(sessionId, timeout);
  }

  /**
   * Extend an active session (e.g., after recharge)
   */
  async extendActiveSession(sessionId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session || session.status !== 'active') return;

    const user = await this.userModel.findById(session.userId).select('wallet').lean();
    if (!user) return;

    const currentBalance = user.wallet.balance || 0;
    const newMaxDurationMinutes = Math.floor(currentBalance / session.ratePerMinute);
    const newMaxDurationSeconds = newMaxDurationMinutes * 60;

    if (newMaxDurationSeconds > session.maxDurationSeconds) {
      this.logger.log(`📈 Extending session ${sessionId}: ${session.maxDurationSeconds}s -> ${newMaxDurationSeconds}s`);

      session.maxDurationSeconds = newMaxDurationSeconds;
      await session.save();

      // 1. Update the Service-level auto-end timeout
      if (this.sessionTimers.has(sessionId)) {
        clearTimeout(this.sessionTimers.get(sessionId)!);
      }
      this.setAutoEndTimer(sessionId, newMaxDurationSeconds);

      // 2. Update the Gateway-level ticker
      this.chatGateway.updateSessionTimer(sessionId, newMaxDurationSeconds);

      // 3. Update Busy status
      const busyUntil = new Date(Date.now() + newMaxDurationSeconds * 1000);
      await this.availabilityService.setBusy(session.astrologerId.toString(), busyUntil);

      return {
        success: true,
        newMaxDurationSeconds
      };
    }
  }

  // ===== USER JOIN TIMEOUT (60 sec after astrologer accepts) =====
  private setUserJoinTimeout(sessionId: string) {
    if (this.joinTimers.has(sessionId)) {
      clearTimeout(this.joinTimers.get(sessionId)!);
      this.joinTimers.delete(sessionId);
    }

    const timeout = setTimeout(async () => {
      try {
        const session = await this.sessionModel.findOne({ sessionId });

        // Only act if user never joined (still waiting)
        if (session && (session.status === 'waiting' || session.status === 'waiting_in_queue')) {
          this.logger.warn(`User did not join chat within 60s for session ${sessionId}`);

          session.status = 'cancelled';
          session.endReason = 'user_no_show';
          session.endTime = new Date();
          session.endedBy = 'system';
          await session.save();

          // ✅ Clear busy status since the user did not join
          await this.availabilityService.setAvailable(session.astrologerId.toString());

          // Update order to completed with 0 duration
          await this.ordersService.completeSession(session.orderId, {
            sessionId: session.sessionId,
            sessionType: 'chat',
            actualDurationSeconds: 0,
            billedMinutes: 0,
            chargedAmount: 0,
            endedBy: 'system',
          });

          // Notify User
          this.notificationService.sendNotification({
            recipientId: session.userId.toString(),
            recipientModel: 'User',
            type: 'session_timeout',
            title: 'Session cancelled',
            message: 'You did not join the chat session. No charges applied.',
            data: {
              type: 'session_timeout',
              mode: 'chat',
              sessionId: session.sessionId,
              orderId: session.orderId,
              reason: 'user_no_show',
            },
            priority: 'medium',
          });

          // ✅ CRITICAL FIX: Emit socket event so Astrologer screen closes
          this.chatGateway.server.to(sessionId).emit('chat_ended', {
            sessionId,
            reason: 'user_no_show',
            status: 'cancelled',
            message: 'User failed to join the session.'
          });

          this.logger.log(`✅ Chat session ${sessionId} cancelled due to user no-show`);
        }

        this.joinTimers.delete(sessionId);
      } catch (error: any) {
        this.logger.error(`User-join timeout error for ${sessionId}: ${error.message}`);
      }
    }, 60 * 1000); // 60 seconds

    this.joinTimers.set(sessionId, timeout);
  }

  public clearUserJoinTimeout(sessionId: string) {
    if (this.joinTimers.has(sessionId)) {
      clearTimeout(this.joinTimers.get(sessionId)!);
      this.joinTimers.delete(sessionId);
    }
  }

  // ===== GET SESSION =====
  async getSession(sessionId: string): Promise<ChatSessionDocument | null> {
    return this.sessionModel.findOne({ sessionId });
  }

  // ===== GET ACTIVE SESSIONS =====
  async getUserActiveSessions(userId: string): Promise<any[]> {
    const sessions = await this.sessionModel
      .find({
        userId: this.toObjectId(userId),
        status: { $in: ['initiated', 'waiting', 'waiting_in_queue', 'active'] }
      })
      .populate('astrologerId', 'name profilePicture isOnline')
      .sort({ createdAt: -1 })
      .lean();

    return sessions.map((session: any) => ({
      ...session,
      profile: session.intakeProfile ? {
        name: session.intakeProfile.name,
        gender: session.intakeProfile.gender,
        dateOfBirth: session.intakeProfile.dateOfBirth,
        timeOfBirth: session.intakeProfile.timeOfBirth,
        placeOfBirth: session.intakeProfile.placeOfBirth,
        // relation: session.intakeProfile.relation,
      } : undefined
    }));
  }

  // ===== GET CHAT HISTORY =====
  async getChatHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.sessionModel
        .find({
          userId: this.toObjectId(userId),
          status: { $in: ['ended', 'cancelled', 'rejected'] }
        })
        .populate('astrologerId', 'name profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.sessionModel.countDocuments({
        userId: this.toObjectId(userId),
        status: { $in: ['ended', 'cancelled', 'rejected'] }
      })
    ]);

    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // ===== UPDATE ONLINE STATUS =====
  async updateOnlineStatus(
    sessionId: string,
    userId: string,
    role: 'user' | 'astrologer',
    isOnline: boolean
  ): Promise<void> {
    const updateField = role === 'user' ? 'userStatus' : 'astrologerStatus';

    await this.sessionModel.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          [`${updateField}.isOnline`]: isOnline,
          [`${updateField}.lastSeen`]: isOnline ? null : new Date()
        }
      }
    );
  }

  // ===== UPDATE LAST MESSAGE =====
  async updateLastMessage(
    sessionId: string,
    content: string,
    type: string,
    sentBy: string
  ): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          lastMessage: {
            content,
            type,
            sentBy,
            sentAt: new Date()
          },
          lastMessageAt: new Date()
        },
        $inc: { messageCount: 1 }
      }
    );
  }

  // ===== CONTINUE EXISTING CHAT =====
  async continueChat(data: {
    userId: string;
    astrologerId: string;
    astrologerName?: string;
    previousSessionId: string;
    ratePerMinute: number;
  }): Promise<any> {
    // Check balance (same logic as initiateChat)
    const estimatedCost = data.ratePerMinute * 5;
    const hasBalance = await this.walletService.checkBalance(data.userId, estimatedCost);

    if (!hasBalance) {
      throw new BadRequestException(
        `Insufficient balance. Minimum ₹${estimatedCost} required to continue chat.`
      );
    }

    let nameToUse = data.astrologerName;
    if (!nameToUse) {
      const astrologer = await this.astrologerModel.findById(data.astrologerId).select('name').lean();
      nameToUse = astrologer?.name || 'Astrologer';
    }

    // FIND CONVERSATION THREAD
    const conversationThread = await this.ordersService.findOrCreateConversationThread(
      data.userId,
      data.astrologerId,
      nameToUse,
      data.ratePerMinute
    );

    const astrologerName = conversationThread.astrologerName || 'Astrologer';

    this.logger.log(`Continuing conversation thread: ${conversationThread.orderId}`);

    // NEW SESSION ID
    const newSessionId = this.generateSessionId();

    // Create "order" entry (updates conversation thread)
    const order = await this.ordersService.createOrder({
      userId: data.userId,
      astrologerId: data.astrologerId,
      astrologerName: astrologerName,
      type: 'chat',
      ratePerMinute: data.ratePerMinute,
      sessionId: newSessionId,
    });

    // CALCULATE SESSION NUMBER
    const sessionNumber = conversationThread.sessionHistory.filter(s => s.sessionType === 'chat').length + 1;

    // CREATE NEW CHAT SESSION (same lifecycle as a fresh chat)
    const session = new this.sessionModel({
      sessionId: newSessionId,
      userId: this.toObjectId(data.userId),
      astrologerId: this.toObjectId(data.astrologerId),
      orderId: conversationThread.orderId,
      conversationThreadId: conversationThread.conversationThreadId,
      sessionNumber,
      ratePerMinute: data.ratePerMinute,
      status: 'initiated',
      requestCreatedAt: new Date(),
      ringTime: new Date(),
      maxDurationMinutes: 0,
      maxDurationSeconds: 0,
      timerStatus: 'not_started',
      timerMetrics: {
        elapsedSeconds: 0,
        remainingSeconds: 0
      },
      previousSessionId: data.previousSessionId || undefined,
    });

    await session.save();

    // ✅ Same 3-min timeout behaviour as initiateChat
    this.setRequestTimeout(newSessionId, conversationThread.orderId, data.userId);

    this.logger.log(
      `Chat continuation created: ${newSessionId} | Thread: ${conversationThread.conversationThreadId} | Session #${sessionNumber}`,
    );

    // Notify astrologer – continuation is also an incoming chat request
    this.notificationService.sendNotification({
      recipientId: data.astrologerId,
      recipientModel: 'Astrologer',
      type: 'chat_request',
      title: 'Chat continued',
      message: 'User wants to continue the conversation.',
      data: {
        type: 'chat_request',
        mode: 'chat',
        sessionId: newSessionId,
        orderId: conversationThread.orderId,
        conversationThreadId: conversationThread.conversationThreadId,
        userId: data.userId,
        previousSessionId: data.previousSessionId,
        sessionNumber,
        ratePerMinute: data.ratePerMinute,
        step: 'chat_continued',
        fullScreen: 'true',
      },
      priority: 'high',
    }).catch(err =>
      this.logger.error(`Chat continue notification error: ${err.message}`),
    );


    return {
      success: true,
      message: 'Chat continuation initiated',
      data: {
        sessionId: newSessionId,
        orderId: conversationThread.orderId,
        conversationThreadId: conversationThread.conversationThreadId,
        sessionNumber,
        status: 'initiated',
        ratePerMinute: data.ratePerMinute,
        previousSessionId: data.previousSessionId,
        totalPreviousSessions: conversationThread.totalSessions,
        totalSpent: conversationThread.totalAmount,
      }
    };
  }

  /**
   * Find and extend any active session for a specific user
   */
  async extendActiveSessionForUser(userId: string): Promise<any> {
    const activeSession = await this.sessionModel.findOne({
      userId: this.toObjectId(userId),
      status: 'active'
    });

    if (activeSession) {
      return this.extendActiveSession(activeSession.sessionId);
    }
  }

}
