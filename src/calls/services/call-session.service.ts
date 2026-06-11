import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { GeminiVoiceService } from '../../ai-voice/services/gemini-voice.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CallSession, CallSessionDocument } from '../schemas/call-session.schema';
import { OrdersService } from '../../orders/services/orders.service';
import { OrderPaymentService } from '../../orders/services/order-payment.service';
import { WalletService } from '../../payments/services/wallet.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { ChatMessageService } from '../../chat/services/chat-message.service';
import { Astrologer, AstrologerDocument } from '../../astrologers/schemas/astrologer.schema';
import { EarningsService } from '../../astrologers/services/earnings.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { PenaltyService } from '../../astrologers/services/penalty.service';
import { CallGateway } from '../gateways/calls.gateway';
import { AstrologerBlockingService } from '../../astrologers/services/astrologer-blocking.service';
import { UserBlockingService } from 'src/users/services/user-blocking.service';
import { AvailabilityService } from '../../astrologers/services/availability.service';
import { SystemSettings, SystemSettingsDocument } from '../../payments/schemas/system-settings.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  private joinTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(CallSession.name) private sessionModel: Model<CallSessionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(SystemSettings.name) private systemSettingsModel: Model<SystemSettingsDocument>,
    @Inject(forwardRef(() => CallGateway))
    private callGateway: CallGateway,
    private ordersService: OrdersService,
    private orderPaymentService: OrderPaymentService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private notificationService: NotificationService,
    private chatMessageService: ChatMessageService,
    private earningsService: EarningsService,
    private penaltyService: PenaltyService,
    private blockingService: AstrologerBlockingService,
    private userBlockingService: UserBlockingService,
    private availabilityService: AvailabilityService,
    @Inject(forwardRef(() => GeminiVoiceService))
    private geminiVoiceService: GeminiVoiceService,
  ) { }

  private generateSessionId(): string {
    return `CALL_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
  }

  private toObjectId(id: string): Types.ObjectId {
    try {
      return new Types.ObjectId(id);
    } catch {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // ===== INITIATE CALL =====
  async initiateCall(sessionData: {
    userId: string;
    astrologerId: string;
    astrologerName: string;
    callType: 'audio' | 'video';
    ratePerMinute: number;
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
        status: { $in: ['initiated', 'ringing', 'waiting', 'waiting_in_queue'] },
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

    // ✅ PREVENT DOUBLE CALLS: Check if user already has an active/pending session
    const existingSession = await this.sessionModel.findOne({
      userId: this.toObjectId(sessionData.userId),
      status: { $in: ['initiated', 'ringing', 'waiting', 'waiting_in_queue', 'active'] }
    });

    if (existingSession) {
      this.logger.warn(`Found existing call session: ${existingSession.sessionId} for user ${sessionData.userId}`);
      throw new BadRequestException('You already have an active call request. Please wait or end it before starting a new one.');
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
        `Insufficient balance. Minimum ₹${estimatedCost} required to start call.`
      );
    }

    const sessionId = this.generateSessionId();

    const conversationThread = await this.ordersService.findOrCreateConversationThread(
      sessionData.userId,
      sessionData.astrologerId,
      sessionData.astrologerName,
      sessionData.ratePerMinute
    );

    const order = await this.ordersService.createOrder({
      userId: sessionData.userId,
      astrologerId: sessionData.astrologerId,
      astrologerName: sessionData.astrologerName,
      type: 'call',
      callType: sessionData.callType,
      ratePerMinute: sessionData.ratePerMinute,
      sessionId: sessionId
    });

    const sessionNumber = order.sessionHistory.filter(s =>
      s.sessionType === 'audio_call' || s.sessionType === 'video_call'
    ).length + 1;

    const session = new this.sessionModel({
      sessionId,
      userId: this.toObjectId(sessionData.userId),
      astrologerId: this.toObjectId(sessionData.astrologerId),
      astrologerModel: 'Astrologer',
      orderId: order.orderId,
      conversationThreadId: order.conversationThreadId,
      sessionNumber,
      callType: sessionData.callType,
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
      userStatus: {
        userId: this.toObjectId(sessionData.userId),
        isOnline: false,
        isMuted: false,
        isVideoOn: sessionData.callType === 'video',
        connectionQuality: 'offline'
      },
      astrologerStatus: {
        astrologerId: this.toObjectId(sessionData.astrologerId),
        isOnline: false,
        isMuted: false,
        isVideoOn: sessionData.callType === 'video',
        connectionQuality: 'offline'
      }
    });

    await session.save();

    this.setRequestTimeout(sessionId, order.orderId, sessionData.userId);

    // ✅ MARK BUSY IMMEDIATELY: Show as busy in list while request is pending
    await this.availabilityService.setBusy(sessionData.astrologerId, new Date(Date.now() + 3 * 60 * 1000));

    const astroNotifType = sessionData.callType === 'video' ? 'call_request_video' : 'call_request_audio';

    const user = await this.userModel.findById(sessionData.userId).select('name profileImage').lean();
    const userName = user?.name || 'User';
    const userProfilePic = user?.profileImage || '';

    this.notificationService.sendNotification({
      recipientId: sessionData.astrologerId,
      recipientModel: 'Astrologer',
      type: astroNotifType,
      title: 'Incoming call request',
      message: `You have a new ${sessionData.callType} call request.`,
      data: {
        type: astroNotifType,
        mode: 'call',
        callType: sessionData.callType,
        sessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        userId: sessionData.userId,
        userName,
        userProfilePic,
        astrologerId: sessionData.astrologerId,
        ratePerMinute: sessionData.ratePerMinute,
        sessionNumber,
        step: 'user_initiated',
        fullScreen: 'true',
      },
      priority: 'urgent',
    }).catch(err => this.logger.error(`Call incoming notification error: ${err.message}`));

    return {
      success: true,
      message: 'Call initiated - waiting for astrologer',
      data: {
        sessionId: session.sessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        sessionNumber,
        status: 'initiated',
        callType: sessionData.callType,
        ratePerMinute: sessionData.ratePerMinute
      }
    };
  }

  // ===== ACCEPT CALL =====
  async acceptCall(sessionId: string, astrologerId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) throw new NotFoundException('Session not found');

    if (session.status !== 'initiated') {
      throw new BadRequestException('Call not in initiated state');
    }

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    session.status = 'waiting';
    session.acceptedAt = new Date();
    await session.save();

    // ✅ Temporarily mark as busy for 2 minutes while ringing (user joins in next 60s)
    await this.availabilityService.setBusy(astrologerId, new Date(Date.now() + 2 * 60 * 1000));

    this.setUserJoinTimeout(sessionId);

    const userNotifType = session.callType === 'video' ? 'call_video' : 'call_audio';

    const astrologer = await this.astrologerModel.findById(astrologerId).select('name profilePicture').lean();
    const astrologerName = astrologer?.name || 'Astrologer';
    const astrologerImage = astrologer?.profilePicture || '';

    this.notificationService.sendNotification({
      recipientId: session.userId.toString(),
      recipientModel: 'User',
      type: userNotifType,
      title: 'Astrologer is ready',
      message: 'Tap to join your call now.',
      data: {
        type: userNotifType,
        mode: 'call',
        callType: session.callType,
        sessionId: session.sessionId,
        orderId: session.orderId,
        astrologerId,
        astrologerName,
        astrologerImage,
        ratePerMinute: session.ratePerMinute,
        step: 'astrologer_accepted',
      },
      priority: 'urgent',
    }).catch(err => this.logger.error(`Call accepted notification error: ${err.message}`));

    if (this.callGateway && typeof this.callGateway.notifyUserOfAcceptance === 'function') {
      this.callGateway.notifyUserOfAcceptance(sessionId, astrologerId, {
        orderId: session.orderId,
        callType: session.callType,
        ratePerMinute: session.ratePerMinute
      }).catch(err => this.logger.error(`Failed to emit call_accepted socket: ${err.message}`));
    }

    return {
      success: true,
      message: 'Call accepted',
      status: 'waiting',
      data: {
        sessionId: session.sessionId,
        orderId: session.orderId,
        callType: session.callType,
        ratePerMinute: session.ratePerMinute,
        astrologerId,
        astrologerName,
        astrologerImage,
        userId: session.userId
      }
    };
  }

  // ===== REJECT CALL =====
  async rejectCall(sessionId: string, astrologerId: string, reason: string): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId });

    if (!session) {
      // If not found, imply it's already gone
      throw new NotFoundException('Session not found');
    }

    // ✅ FIX: Be specific about state. If cancelled, return 'already cancelled' logic instead of erroring 
    if (session.status === 'cancelled' || session.status === 'rejected') {
      // ✅ SUCCESS: No penalty if already cancelled/rejected
      return { success: true, message: 'Call already cancelled or rejected' };
    }

    if (session.status !== 'initiated' && session.status !== 'waiting') {
      throw new BadRequestException(`Call cannot be rejected at this stage (${session.status})`);
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

    // ✅ Clear busy status since the call was rejected
    await this.availabilityService.setAvailable(astrologerId);

    // Apply Penalty Logic (Skip for AI)
    if (!session.isAi) {
      try {
        await this.penaltyService.applyPenalty({
          astrologerId,
          type: 'missed_appointment',
          amount: 30, // ₹30 penalty for rejecting call
          reason: 'Call request rejected',
          description: `Rejected ${session.callType} call request`,
          orderId: session.orderId,
          userId: session.userId.toString(),
          appliedBy: 'system',
        });
      } catch (error: any) {
        this.logger.error(`❌ Failed to apply penalty: ${error.message}`);
      }
    }

    // Cancel Order (Skip for AI)
    if (!session.isAi) {
      try {
        await this.ordersService.cancelOrder(session.orderId, session.userId.toString(), reason, 'astrologer');
      } catch (e: any) {
        this.logger.error(`❌ Failed to cancel order during call rejection: ${e.message}`);
      }
    }

    // Send Push Notification
    this.notificationService.sendNotification({
      recipientId: session.userId.toString(),
      recipientModel: 'User',
      type: 'request_rejected',
      title: 'Call request rejected',
      message: 'Astrologer rejected your call request.',
      data: {
        type: 'request_rejected',
        mode: 'call',
        sessionId: session.sessionId,
      },
      priority: 'high',
    }).catch(err => this.logger.error(`Call rejected notification error: ${err.message}`));

    if (this.callGateway && typeof this.callGateway.notifyUserOfRejection === 'function') {
      this.callGateway.notifyUserOfRejection(sessionId, astrologerId, reason)
        .catch(err => this.logger.error(`Failed to emit call_rejected socket: ${err.message}`));
    }

    return { success: true, message: 'Call rejected' };
  }


  /**
   * Continue a previously ended, cancelled, or rejected call session by creating a new call request.
   * Skips online/offline availability check for AI astrologers.
   */
  async continueCall(previousSessionId: string, userId: string): Promise<any> {
    // Validate previous session exists and belongs to user
    const prevSession = await this.sessionModel.findOne({ sessionId: previousSessionId });
    if (!prevSession) throw new NotFoundException('Previous session not found');
    if (!prevSession.userId.equals(this.toObjectId(userId))) {
      throw new BadRequestException('You are not the owner of this session');
    }
    // Only allow continuation from ended, cancelled or rejected sessions
    if (!['ended', 'cancelled', 'rejected'].includes(prevSession.status)) {
      throw new BadRequestException('Previous session is not in a state that can be continued');
    }

    // ✅ PREVENT DOUBLE CALLS: Check if user already has another active/pending session
    const existingSession = await this.sessionModel.findOne({
      userId: this.toObjectId(userId),
      status: { $in: ['initiated', 'ringing', 'waiting', 'waiting_in_queue', 'active'] },
    });
    if (existingSession) {
      throw new BadRequestException('You already have an active call request or session. Please end it before continuing this one.');
    }

    const astrologerId = prevSession.astrologerId.toString();
    const isAi = !!prevSession.isAi;
    // For human astrologers ensure they are marked available before new request
    if (!isAi) {
      await this.availabilityService.setAvailable(astrologerId);
    }

    // Re‑check wallet balance (minimum 5 minutes of call)
    const ratePerMinute = prevSession.ratePerMinute;
    const minBalance = ratePerMinute * 5;
    const hasBalance = await this.walletService.checkBalance(userId, minBalance);
    if (!hasBalance) {
      throw new BadRequestException(`Insufficient balance. Minimum ₹${minBalance} required.`);
    }

    // Retrieve user and astrologer info
    const user = await this.userModel.findById(userId);
    const astrologer = await this.astrologerModel.findById(astrologerId).lean();
    const astroName = (astrologer as any)?.name || 'Astrologer';

    // Find or create conversation thread (reuse same order thread)
    const order = await this.ordersService.findOrCreateConversationThread(
      userId,
      astrologerId,
      astroName,
      ratePerMinute,
    );

    // Create a brand‑new call session record
    const newSessionId = this.generateSessionId();
    const now = new Date();
    const sessionNumber = order.sessionHistory.filter(s =>
      s.sessionType === (prevSession.callType === 'audio' ? 'audio_call' : 'video_call')
    ).length + 1;

    const newSession = new this.sessionModel({
      sessionId: newSessionId,
      userId: this.toObjectId(userId),
      astrologerId: this.toObjectId(astrologerId),
      orderId: order.orderId,
      conversationThreadId: order.conversationThreadId,
      sessionNumber,
      callType: prevSession.callType,
      ratePerMinute,
      status: 'initiated',
      requestCreatedAt: now,
      ringTime: now,
      maxDurationMinutes: 0,
      maxDurationSeconds: 0,
      timerStatus: 'not_started',
      timerMetrics: { elapsedSeconds: 0, remainingSeconds: 0 },
      userStatus: {
        userId: this.toObjectId(userId),
        isOnline: false,
        isMuted: false,
        isVideoOn: prevSession.callType === 'video',
        connectionQuality: 'offline',
      },
      astrologerStatus: {
        astrologerId: this.toObjectId(astrologerId),
        isOnline: false,
        isMuted: false,
        isVideoOn: prevSession.callType === 'video',
        connectionQuality: 'offline',
      },
      isAi,
    });
    await newSession.save();

    // Notify astrologer of new call request (same payload as initiateCall)
    const userName = user?.name || 'User';
    const userProfilePic = (user as any)?.profileImage || '';
    const notifType = prevSession.callType === 'video' ? 'call_request_video' : 'call_request_audio';
    this.notificationService.sendNotification({
      recipientId: astrologerId,
      recipientModel: 'Astrologer',
      type: notifType,
      title: 'Incoming call request',
      message: `You have a new ${prevSession.callType} call request.`,
      data: {
        type: notifType,
        mode: 'call',
        callType: prevSession.callType,
        sessionId: newSessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        userId,
        userName,
        userProfilePic,
        astrologerId,
        ratePerMinute,
        sessionNumber,
        step: 'user_initiated',
        fullScreen: 'true',
      },
      priority: 'urgent',
    }).catch(err => this.logger.error(`Call incoming notification error: ${err.message}`));

    // For human astrologers briefly mark busy (mirrors initiateCall behavior)
    if (!isAi) {
      await this.availabilityService.setBusy(astrologerId, new Date(Date.now() + 3 * 60 * 1000));
    }

    return {
      success: true,
      message: 'Call continued - waiting for astrologer',
      data: {
        sessionId: newSessionId,
        orderId: order.orderId,
        conversationThreadId: order.conversationThreadId,
        sessionNumber,
        status: 'initiated',
        callType: prevSession.callType,
        ratePerMinute,
      },
    };
  }

  // ===== START CALL SESSION =====

  async startSession(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    // ✅ CHECK: If already active, return existing state immediately
    if (session.status === 'active') {
      this.logger.warn(`Session ${sessionId} is already active. Returning existing state.`);
      return {
        success: true,
        message: 'Call session already active',
        data: {
          status: 'active',
          maxDurationMinutes: session.maxDurationMinutes,
          maxDurationSeconds: session.maxDurationSeconds,
          ratePerMinute: session.ratePerMinute,
          callType: session.callType,
        },
      };
    }

    if (session.status !== 'waiting' && session.status !== 'waiting_in_queue') {
      throw new BadRequestException(`Session not in valid state to start: ${session.status}`);
    }

    const walletBalance = await this.walletService.getBalance(session.userId.toString());
    const maxDurationMinutes = Math.floor(walletBalance / session.ratePerMinute);
    const maxDurationSeconds = maxDurationMinutes * 60;

    if (maxDurationMinutes < 1) {
      throw new BadRequestException('Insufficient balance to start call');
    }

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

    if (session.userStatus) {
      session.userStatus.isOnline = true;
      session.userStatus.connectionQuality = 'good';
    }
    if (session.astrologerStatus) {
      session.astrologerStatus.isOnline = true;
      session.astrologerStatus.connectionQuality = 'good';
    }

    await session.save();
    this.clearUserJoinTimeout(sessionId);
    if (!session.isAi) {
      await this.ordersService.updateOrderStatus(session.orderId, 'active');
    }
    this.setAutoEndTimer(sessionId, maxDurationSeconds);

    this.logger.log(`Call session started: ${sessionId}`);

    return {
      success: true,
      message: 'Call session started',
      data: {
        status: 'active',
        maxDurationMinutes,
        maxDurationSeconds,
        ratePerMinute: session.ratePerMinute,
        callType: session.callType,
      },
    };
  }

  /**
   * ✅ NEW: Simple update helper for sessions
   */
  async updateSessionData(sessionId: string, update: any): Promise<void> {
    await this.sessionModel.updateOne({ sessionId }, { $set: update });
    this.logger.log(`📝 [CallSessionService] Updated session ${sessionId}: ${JSON.stringify(update)}`);
  }

  // ===== END CALL SESSION (OPTIMIZED) =====
  async endSession(
    sessionId: string,
    endedBy: string,
    reason: string,
    recordingUrl?: string,         // Optional now
    recordingS3Key?: string,       // Optional now
    recordingDuration?: number,    // Optional now
    transcript?: string,           // ✅ NEW: Added transcript parameter
    forcedActualDurationSeconds?: number, // ✅ NEW: Forced duration (e.g. from webhook)
  ): Promise<any> {
    // 1. ATOMIC LOCK: Use findOneAndUpdate to ensure only ONE thread processes the end-session logic
    // This prevents race conditions between multiple webhooks (call.ended, end-of-call-report) and user-hangup socket events.
    const session = await this.sessionModel.findOneAndUpdate(
      { sessionId, status: { $nin: ['ended', 'cancelled'] } },
      { $set: { status: 'ended', endTime: new Date(), endedBy, endReason: reason } },
      { new: true }
    ).populate('astrologerId');

    if (!session) {
      this.logger.log(`⚠️ [CallSessionService] endSession called for already ended or non-existent session: ${sessionId}. Skipping duplicate closure.`);
      return { success: true, message: 'Session already ended' };
    }

    if (transcript) {
       session.transcript = transcript;
    }

    const astroId = (session.astrologerId['_id'] || session.astrologerId).toString();

    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }

    // Idempotency Check (Redundant due to findOneAndUpdate but kept for safety)
    if (session.status === 'ended' && session.isPaid) {
      return {
        success: true,
        message: 'Call session already ended and paid',
        data: {
          sessionId,
          actualDuration: session.duration || 0,
          billedMinutes: session.billedMinutes || 0,
          chargeAmount: session.totalAmount || 0,
          status: session.status
        }
      };
    }

    let actualDurationSeconds = 0;

    // Note: session.status is now 'ended' due to the atomic update above, 
    // but we proceed if it was successfully matched and has a startTime
    if (session.startTime) {
      const endTime = new Date();
      actualDurationSeconds = forcedActualDurationSeconds !== undefined 
        ? forcedActualDurationSeconds 
        : Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

      // Cap to max duration to prevent overcharging (even if ended manually after timeout)
      if (actualDurationSeconds > session.maxDurationSeconds) {
        actualDurationSeconds = session.maxDurationSeconds;
      }

      // ✅ SAFETY: If call connected, duration should be at least 1s to avoid 0m 0s display
      if (actualDurationSeconds <= 0) {
        actualDurationSeconds = 1;
      }
      session.duration = actualDurationSeconds;
      
      this.logger.log(`📊 [CallSessionService] Billing for session ${sessionId}: Duration=${actualDurationSeconds}s, Rate=${session.ratePerMinute}`);

      // ✅ SUPER ROBUST BILLING: Round UP to the nearest minute, minimum 1 minute
      const calculatedBilledMinutes = Math.ceil(actualDurationSeconds / 60);
      session.billedMinutes = Math.max(1, calculatedBilledMinutes);
      
      session.totalAmount = session.billedMinutes * session.ratePerMinute;
      session.totalCost = session.totalAmount;
      
      this.logger.log(`💰 [CallSessionService] Billed Minutes: ${session.billedMinutes}, Total: ₹${session.totalAmount}`);
      
      if (session.isAi) {
        // AI calls: 100% goes to the platform
        session.platformCommission = session.totalAmount;
        session.astrologerEarning = 0;
      } else {
        // Human calls: split based on astrologer specific or global default (with 50/50 fallback)
        let commissionRate = 50;
        const astrologer = await this.astrologerModel.findById(astroId);
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
    }

    if (session.isAi && session.ratePerMinute === 0) {
      session.isPaid = true;
      await this.userModel.findByIdAndUpdate(session.userId, { isAiFirstConsultationUsed: true });
    }

    // Process Payment - proceed even if status is 'ended' now, as long as amount > 0
    if (session.totalAmount > 0) {
      try {
        if (session.isAi) {
          // AI Payment Logic
          const aiProfile = session.astrologerId as any;
          const aiName = aiProfile?.name || 'AI Astrologer';
          
          this.logger.log(`💳 Deducting ${session.totalAmount} for AI session ${session.sessionId}`);
          await this.walletService.deductFromWallet(
            session.userId.toString(),
            session.totalAmount,
            session.orderId || session.sessionId,
            `AI Voice Consultation`,
            undefined,
            {
              sessionId: session.sessionId,
              durationSeconds: actualDurationSeconds,
              billedMinutes: session.billedMinutes,
              isAi: true,
            },
            aiName
          );
          session.isPaid = true;
        } else {
          // Human Astrologer Payment Logic
          const [user, astrologer] = await Promise.all([
            this.userModel.findById(session.userId).select('name').lean(),
            this.astrologerModel.findById(session.astrologerId['_id'] || session.astrologerId).select('name').lean(),
          ]);

          const paymentResult = await this.walletService.processSessionPayment({
            userId: session.userId.toString(),
            astrologerId: (session.astrologerId['_id'] || session.astrologerId).toString(),
            amount: session.totalAmount,
            orderId: session.orderId,
            sessionId: session.sessionId,
            sessionType: session.callType === 'audio' ? 'audio_call' : 'video_call',
            userName: user?.name || 'User',
            astrologerName: astrologer?.name || 'Astrologer',
            durationMinutes: session.billedMinutes,
          });

          if (paymentResult.success) {
            await this.earningsService.updateEarnings(
              astroId,
              session.totalAmount,
              'call',
              session.billedMinutes,
              session.astrologerEarning,
              session.platformCommission,
            );
            session.isPaid = true;
          }
        }
      } catch (error: any) {
        this.logger.error(`❌ Payment failed for session ${sessionId}: ${error.message}`);
        session.isPaid = false;
      }
    }

    // session.status = 'ended'; // Already set via findOneAndUpdate
    // session.endTime = new Date(); // Already set via findOneAndUpdate
    // session.endedBy = endedBy; // Already set via findOneAndUpdate
    // session.endReason = reason; // Already set via findOneAndUpdate
    session.timerStatus = 'ended';

    // ✅ If recording is provided immediately (unlikely in parallel mode, but supported)
    if (recordingUrl && actualDurationSeconds > 0) {
      session.hasRecording = true;
      session.recordingUrl = recordingUrl;
      session.recordingS3Key = recordingS3Key;
      session.recordingDuration = recordingDuration || actualDurationSeconds;
      session.recordingType = session.callType === 'audio' ? 'voice_note' : 'video';
      session.recordingStartedAt = session.startTime;
      session.recordingEndedAt = new Date();

      // Async chat message creation
      this.createRecordingChatMessage(
        sessionId, session.orderId, session.conversationThreadId!,
        session.userId.toString(), astroId,
        session.callType as 'audio' | 'video', recordingUrl, recordingS3Key!,
        session.recordingDuration, actualDurationSeconds,
        session.astrologerModel || 'Astrologer'
      ).then(mid => {
        this.sessionModel.updateOne({ sessionId }, { recordingMessageId: mid }).exec();
      }).catch(e => this.logger.error('Chat msg failed', e));
    } else if (transcript && actualDurationSeconds > 0) {
      // ✅ NEW: Save transcript to chat if no recording exists
      this.createTranscriptChatMessage(
        sessionId, session.orderId, session.conversationThreadId!,
        session.userId.toString(), astroId,
        transcript,
        session.astrologerModel || 'Astrologer'
      ).then(mid => {
        this.sessionModel.updateOne({ sessionId }, { recordingMessageId: mid }).exec();
      }).catch(e => this.logger.error('Transcript chat msg failed', e));
    }

    if (session.userStatus) session.userStatus.isOnline = false;
    if (session.astrologerStatus) session.astrologerStatus.isOnline = false;

    await session.save();

    // ✅ Clear busy status since the call ended
    await this.availabilityService.setAvailable(astroId);

    // Async Order Completion (Required for AI and Human calls)
    const resolvedTranscript = session.isAi ? 
      (session.voiceProvider === 'gemini' ? this.geminiVoiceService.getTranscript(sessionId) : (transcript || session.transcript))
      : undefined;

    this.ordersService.completeSession(session.orderId, {
      sessionId: sessionId,
      sessionType: session.callType === 'audio' ? 'audio_call' : 'video_call',
      actualDurationSeconds: actualDurationSeconds,
      billedMinutes: session.billedMinutes,
      chargedAmount: session.totalAmount,
      recordingUrl: recordingUrl,
      recordingS3Key: recordingS3Key,
      recordingDuration: session.recordingDuration,
      endedBy: session.endedBy,
      transcript: resolvedTranscript,
      startTime: session.startTime,
      endTime: session.endTime,
    }).catch(e => this.logger.error('Order completion update failed', e));

    return {
      success: true,
      message: 'Call session ended',
      data: {
        sessionId,
        actualDuration: actualDurationSeconds,
        billedMinutes: session.billedMinutes,
        chargeAmount: session.totalAmount,
        status: 'ended',
      },
    };
  }

  // ✅ NEW METHOD: Called asynchronously by Gateway after recording stops
  async updateRecordingAfterEnd(sessionId: string, url: string, key: string, duration: number, transcript?: string) {
    try {
      const session = await this.sessionModel.findOne({ sessionId });
      if (!session) return;

      session.hasRecording = true;
      session.recordingUrl = url;
      session.recordingS3Key = key;
      session.recordingDuration = duration || session.duration;
      if (transcript) session.transcript = transcript;
      // Ensure correct Enum value
      session.recordingType = session.callType === 'audio' ? 'voice_note' : 'video';

      await session.save();
      this.logger.log(`🎥 Recording updated for ended session: ${sessionId}`);

      // 1. Sync to Chat Message
      await this.createRecordingChatMessage(
        sessionId, session.orderId, session.conversationThreadId!,
        session.userId.toString(), session.astrologerId.toString(),
        session.callType as 'audio' | 'video', url, key, session.recordingDuration, session.duration
      );

      // 2. ✅ Sync to Order History (FIX FOR ADMIN PANEL)
      await this.ordersService.updateSessionRecording(
        session.orderId,
        sessionId,
        {
          recordingUrl: url,
          recordingS3Key: key,
          recordingDuration: duration || session.duration,
          recordingType: session.recordingType,
          transcript: transcript || session.transcript
        }
      );

    } catch (e) {
      this.logger.error(`Failed to update recording for ${sessionId}: ${e.message}`);
    }
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

  private async createRecordingChatMessage(sessionId: string, orderId: string, conversationThreadId: string, userId: string, astrologerId: string, callType: 'audio' | 'video', recordingUrl: string, recordingS3Key: string, recordingDuration: number, actualDurationSeconds: number, astrologerModel: string = 'Astrologer'): Promise<string> {
    const mins = Math.floor(actualDurationSeconds / 60);
    const secs = actualDurationSeconds % 60;
    const durationText = `${mins}:${String(secs).padStart(2, '0')}`;
    const messageType = callType === 'video' ? 'video' : 'voice_note';
    const content = callType === 'video' ? `📹 Video Call Recording - ${durationText}` : `🎤 Voice Call Recording - ${durationText}`;

    const message = await this.chatMessageService.sendMessage({
      sessionId: sessionId, orderId: orderId, senderId: userId, senderModel: 'System' as any, receiverId: astrologerId, receiverModel: astrologerModel as any,
      type: messageType, content, fileUrl: recordingUrl, fileS3Key: recordingS3Key, fileDuration: recordingDuration, isCallRecording: true, linkedSessionId: sessionId,
    });
    return message.messageId;
  }

  private async createTranscriptChatMessage(sessionId: string, orderId: string, conversationThreadId: string, userId: string, astrologerId: string, transcript: string, astrologerModel: string = 'Astrologer'): Promise<string> {
    const content = `📄 AI Voice Call Transcript:\n\n${transcript}`;
    
    const message = await this.chatMessageService.sendMessage({
      sessionId: sessionId, 
      orderId: orderId, 
      senderId: userId, 
      senderModel: 'System' as any, 
      receiverId: astrologerId, 
      receiverModel: astrologerModel as any,
      type: 'text', 
      content, 
      isCallRecording: false, 
      linkedSessionId: sessionId,
    });
    return message.messageId;
  }

  private setRequestTimeout(sessionId: string, orderId: string, userId: string) {
    const timeout = setTimeout(async () => {
      try {
        const session = await this.sessionModel.findOne({ sessionId });
        if (!session || (session.status !== 'initiated' && session.status !== 'waiting')) return;

        this.logger.warn(`[Timeout] Cancelling initiated/waiting Call ${sessionId} due to no response`);

        session.status = 'cancelled';
        session.endReason = 'astrologer_no_response';
        session.endTime = new Date();
        await session.save();

        // ✅ Clear busy status since the call was cancelled by timeout
        await this.availabilityService.setAvailable(session.astrologerId.toString());

        // Apply Penalty & Handle Order (Skip for AI)
        if (!session.isAi) {
          try {
            await this.penaltyService.applyPenalty({
              astrologerId: session.astrologerId.toString(),
              type: 'late_response',
              amount: 30, // ₹30 penalty for not responding to call
              reason: 'No response to call request',
              description: `Did not respond to ${session.callType} call request within 3 minutes`,
              orderId: session.orderId,
              userId: session.userId.toString(),
              appliedBy: 'system',
            });
          } catch (error: any) { }

          await this.ordersService.handleOrderTimeout(orderId);
        }
        this.sessionTimers.delete(sessionId);
      } catch (error: any) { }
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
            this.logger.warn(`🧹 [Cron] Terminating stale call session ${session.sessionId}. Elapsed: ${elapsedSeconds}s, Max: ${session.maxDurationSeconds}s`);
            
            // Emit socket events before terminating
            if (this.callGateway && typeof this.callGateway.server !== 'undefined') {
              this.callGateway.server.to(session.sessionId).emit('timer_ended', {
                sessionId: session.sessionId,
                reason: 'max_duration_reached',
                timestamp: new Date()
              });
            }
            await this.callGateway.terminateCall(session.sessionId, 'system', 'timeout');
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ [Cron] Error in handleStaleSessions (Call): ${error.message}`);
    }
  }

  private setAutoEndTimer(sessionId: string, maxDurationSeconds: number) {
    const timeout = setTimeout(async () => {
      try {
        if (this.callGateway) {
          await this.callGateway.terminateCall(sessionId, 'system', 'timeout');
        } else {
          await this.endSession(sessionId, 'system', 'timeout');
        }
        this.sessionTimers.delete(sessionId);
      } catch (error: any) { }
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
      this.logger.log(`📈 Extending call session ${sessionId}: ${session.maxDurationSeconds}s -> ${newMaxDurationSeconds}s`);

      session.maxDurationSeconds = newMaxDurationSeconds;
      await session.save();

      // 1. Update the Service-level auto-end timeout
      if (this.sessionTimers.has(sessionId)) {
        clearTimeout(this.sessionTimers.get(sessionId)!);
      }
      this.setAutoEndTimer(sessionId, newMaxDurationSeconds);

      // 2. Update the Gateway-level ticker
      this.callGateway.updateSessionTimer(sessionId, newMaxDurationSeconds);

      // 3. Update Busy status
      const busyUntil = new Date(Date.now() + newMaxDurationSeconds * 1000);
      await this.availabilityService.setBusy(session.astrologerId.toString(), busyUntil);

      return {
        success: true,
        newMaxDurationSeconds
      };
    }
  }

  private setUserJoinTimeout(sessionId: string) {
    if (this.joinTimers.has(sessionId)) {
      clearTimeout(this.joinTimers.get(sessionId)!);
      this.joinTimers.delete(sessionId);
    }
    const timeout = setTimeout(async () => {
      try {
        const session = await this.sessionModel.findOne({ sessionId });
        if (!session) return;
        if (session.status === 'waiting' || session.status === 'waiting_in_queue') {
          await this.callGateway.terminateCall(sessionId, 'system', 'user_no_show');
        }
        this.joinTimers.delete(sessionId);
      } catch (error: any) { }
    }, 60 * 1000);
    this.joinTimers.set(sessionId, timeout);
  }

  private clearUserJoinTimeout(sessionId: string) {
    if (this.joinTimers.has(sessionId)) {
      clearTimeout(this.joinTimers.get(sessionId)!);
      this.joinTimers.delete(sessionId);
    }
  }

  async getSession(sessionId: string): Promise<CallSessionDocument | null> {
    return this.sessionModel.findOne({ sessionId }).exec();
  }

  async getUserActiveSessions(userId: string): Promise<CallSessionDocument[]> {
    return this.sessionModel
      .find({
        userId: this.toObjectId(userId),
        status: { $in: ['initiated', 'waiting', 'waiting_in_queue', 'active'] }
      })
      .populate('astrologerId', 'name profilePicture image isOnline')
      .sort({ createdAt: -1 });
  }

  async updateParticipantStatus(sessionId: string, userId: string, role: string, statusUpdate: any): Promise<void> {
    const updateField = role === 'user' ? 'userStatus' : 'astrologerStatus';
    const updateObj: any = {};
    Object.keys(statusUpdate).forEach(key => {
      updateObj[`${updateField}.${key}`] = statusUpdate[key];
    });

    // ✅ Track lastSeen when user/astrologer goes offline
    if (statusUpdate.isOnline === false) {
      updateObj[`${updateField}.lastSeen`] = new Date();
    } else if (statusUpdate.isOnline === true) {
      updateObj[`${updateField}.lastSeen`] = null;
    }

    await this.sessionModel.findOneAndUpdate({ sessionId }, { $set: updateObj });
  }

  async endCall(sessionId: string, options: { endedBy: string; reason: string }): Promise<any> {
    return this.endSession(sessionId, options.endedBy, options.reason);
  }

  

  async cancelCall(sessionId: string, userId: string, reason: string, cancelledBy: any): Promise<any> {
    const session = await this.sessionModel.findOne({ sessionId, userId: this.toObjectId(userId), status: { $in: ['initiated', 'waiting'] } });
    if (!session) throw new NotFoundException('Call not found');
    session.status = 'cancelled';
    session.endReason = reason;
    session.endedBy = cancelledBy;
    session.endTime = new Date();
    await session.save();

    // ✅ Clear busy status since the call was cancelled by user
    await this.availabilityService.setAvailable(session.astrologerId.toString());

    return { success: true, message: 'Call cancelled' };
  }

  async getAstrologerCallSessions(
    astrologerId: string,
    filters: { page: number; limit: number; status?: string }
  ): Promise<any> {
    const skip = (filters.page - 1) * filters.limit;
    const query: any = {
      astrologerId: this.toObjectId(astrologerId)
    };

    if (filters.status) {
      query.status = filters.status;
    }

    const [sessions, total] = await Promise.all([
      this.sessionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .populate('userId', 'name profileImage phoneNumber')
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

  async getAstrologerCallSessionDetails(sessionId: string, astrologerId: string): Promise<any> {
    const session = await this.sessionModel.findOne({
      sessionId,
      astrologerId: this.toObjectId(astrologerId)
    })
      .populate('userId', 'name profileImage phoneNumber gender dateOfBirth placeOfBirth timeOfBirth')
      .lean();

    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    return { success: true, data: session };
  }

  async getCallHistory(userId: string, page: number, limit: number): Promise<any> {
    const skip = (page - 1) * limit;
    const query = { 
      userId: this.toObjectId(userId),
      astrologerModel: { $ne: 'AiAstrologerProfile' }
    };

    const [sessions, total] = await Promise.all([
      this.sessionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('astrologerId', 'name profilePicture image')
        .lean(),
      this.sessionModel.countDocuments(query)
    ]);

    const formattedSessions = sessions.map(s => {
      const astrologer = s.astrologerId as any;
      

      return {
        ...s,
        astrologerId: {
          ...astrologer,
          profilePicture: astrologer?.profilePicture || astrologer?.image || '/vaidiktalklogo.png'
        }
      };
    });

    return {
      sessions: formattedSessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

}