// src/calls/gateways/calls.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, BadRequestException } from '@nestjs/common';
import { CallSessionService } from '../services/call-session.service';
import { CallRecordingService } from '../services/call-recording.service';
import { AgoraService } from '../services/agora.service';
import { CallBillingService } from '../services/call-billing.service';
import { forwardRef, Inject } from '@nestjs/common';
import { GeminiVoiceService } from '../../ai-voice/services/gemini-voice.service';

@WebSocketGateway({
  cors: { 
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3005',
      'https://vaidiktalk-ai-2.vercel.app',
      'https://vaidiktalk-ai-2-1a2t.vercel.app',
      'https://vaidiktalkweb.vercel.app',
      'https://admin.vaidiktalk.com',
      'https://app.vaidiktalk.com',
      'https://vaidiktalk.com',
      'https://web-vaidik-git-test-server-vadik-talks-projects.vercel.app',
      'https://vaidik-admin-git-test-server-vadik-talks-projects.vercel.app',
      'https://web-vaidik-main.vercel.app',
      'https://admin-portal-rho-two.vercel.app',
      'https://admin-portal-9x2pjk4h9-rajkumaryadav2749s-projects.vercel.app'
    ], 
    credentials: true 
  },
  namespace: '/calls',
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CallGateway.name);
  private activeUsers = new Map<string, { socketId: string; userId: string; role: string; sessionId?: string }>();
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  private sessionTimerData = new Map<string, { maxDurationSeconds: number; secondsElapsed: number }>();
  private userSockets = new Map<string, string>();
  private astrologerSockets = new Map<string, string>();
  private activeRecordings = new Map<string, string>();

  // ✅ LOCK: Prevent double processing of end call
  private processingEndCall = new Set<string>();

  constructor(
    @Inject(forwardRef(() => CallSessionService))
    private callSessionService: CallSessionService,
    private callRecordingService: CallRecordingService,
    private agoraService: AgoraService,
    private callBillingService: CallBillingService,
    @Inject(forwardRef(() => GeminiVoiceService))
    private geminiVoiceService: GeminiVoiceService
  ) { }

  async handleConnection(client: Socket) {
    this.logger.log(`Call client connected: ${client.id}`);

    // Extract User ID from handshake (support both auth and query)
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (userId) {
      this.userSockets.set(userId.toString(), client.id);
      this.logger.log(`✅ [CallGateway] Registered User Socket globally: ${userId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Call client disconnected: ${client.id}`);
    for (const [uid, sid] of this.userSockets.entries()) {
      if (sid === client.id) {
        this.userSockets.delete(uid);
        break;
      }
    }
    for (const [userId, userData] of this.activeUsers.entries()) {
      if (userData.socketId === client.id) {
        if (userData.sessionId) {
          this.callSessionService.updateParticipantStatus(
            userData.sessionId, userId, userData.role as 'user' | 'astrologer',
            { isOnline: false, connectionQuality: 'offline' }
          ).catch(e => { });
          client.to(userData.sessionId).emit('participant_disconnected', { userId, role: userData.role });
        }
        this.activeUsers.delete(userId);
        if (userData.role === 'astrologer') this.astrologerSockets.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('register_astrologer')
  handleRegisterAstrologer(@ConnectedSocket() client: Socket, @MessageBody() data: { astrologerId: string }) {
    this.astrologerSockets.set(data.astrologerId, client.id);
    return { success: true };
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    if (data.userId) {
      this.userSockets.set(data.userId, client.id);
      this.logger.log(`✅ [CallGateway] User registered: ${data.userId} | Socket: ${client.id}`);
    }
    return { success: true };
  }

  @SubscribeMessage('initiate_call')
  async handleInitiateCall(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    try {
      const result = await this.callSessionService.initiateCall({
        userId: data.userId,
        astrologerId: data.astrologerId,
        astrologerName: data.astrologerName,
        callType: data.callType,
        ratePerMinute: data.ratePerMinute
      });
      const astroSocketId = this.astrologerSockets.get(data.astrologerId);
      const payload = {
        sessionId: result.data.sessionId,
        orderId: result.data.orderId,
        userId: data.userId,
        callType: data.callType,
        ratePerMinute: data.ratePerMinute,
        requestExpiresIn: 180000,
        timestamp: new Date(),
      };
      if (astroSocketId) this.server.to(astroSocketId).emit('incoming_call', payload);
      else this.server.emit('incoming_call_to_astrologer', { astrologerId: data.astrologerId, ...payload });
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }

  @SubscribeMessage('accept_call')
  async handleAcceptCall(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    try {
      const result = await this.callSessionService.acceptCall(data.sessionId, data.astrologerId);

      const eventPayload = {
        ...(result.data || {}),
        sessionId: data.sessionId,
        astrologerId: data.astrologerId,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to Room (in case they ARE joined)
      this.server.to(data.sessionId).emit('call_accepted', eventPayload);

      // 🟢 GUARANTEED DELIVERY: Send directly to User's socket via Global Map
      // Ensure we have the userId from the service result or the incoming data
      const targetUserId = result.data?.userId || data.userId;

      if (targetUserId) {
        const userSocketId = this.userSockets.get(targetUserId.toString());
        if (userSocketId) {
          this.server.to(userSocketId).emit('call_accepted', eventPayload);
          this.logger.log(`✅ [CallGateway] DIRECT send 'call_accepted' to user: ${targetUserId}`);
        } else {
          this.logger.warn(`⚠️ [CallGateway] User ${targetUserId} socket not found in global map`);
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`❌ [CallGateway] Accept error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('user_joined_agora')
  async handleUserJoinedAgora(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string; role: string }) {
    this.logger.log(`✅ ${data.role} joined Agora for ${data.sessionId}`);

    const session = await this.callSessionService.getSession(data.sessionId);
    if (!session) return;

    if (data.role === 'user') session.userJoinedAgora = true;
    else if (data.role === 'astrologer') session.astrologerJoinedAgora = true;

    await session.save();

    // STRICT CHECK: Both must be in Agora to start timer (OR it's an AI call)
    if ((session.userJoinedAgora === true && session.astrologerJoinedAgora === true && session.status !== 'active') || (session.isAi && session.userJoinedAgora)) {
      this.logger.log(`🚀 Call starting for ${data.sessionId}${session.isAi ? ' (AI session)' : ''}. Starting timer NOW!`);
      await this.startCallInternal(data.sessionId);
    } else {
      this.logger.log(`⏳ Waiting for other party... User: ${session.userJoinedAgora}, Astro: ${session.astrologerJoinedAgora}`);
    }
  }

  @SubscribeMessage('reject_call')
  async handleRejectCall(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    try {
      const session = await this.callSessionService.getSession(data.sessionId);
      if (!session) return { success: false, message: 'Session not found' };

      const astrologerId = data.astrologerId || session.astrologerId.toString();

      const result = await this.callSessionService.rejectCall(data.sessionId, astrologerId, data.reason || 'rejected');

      const targetUserId = session.userId?.toString();

      if (targetUserId) {
        const userSocketId = this.userSockets.get(targetUserId);
        if (userSocketId) {
          this.server.to(userSocketId).emit('call_rejected', {
            sessionId: data.sessionId,
            reason: data.reason || 'rejected'
          });
          this.logger.log(`✅ [CallGateway] DIRECT send 'call_rejected' to user: ${targetUserId}`);
        } else {
          this.logger.warn(`⚠️ [CallGateway] User ${targetUserId} socket not found in global map for rejection`);
        }
      }
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }

  @SubscribeMessage('cancel_call')
  async handleCancelCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; userId: string; reason?: string }
  ) {
    try {
      this.logger.log(`📡 [CallGateway] cancel_call received for ${data.sessionId}`);
      const result = await this.callSessionService.cancelCall(
        data.sessionId,
        data.userId,
        data.reason || 'user_cancelled',
        'user'
      );

      // Notify the astrologer that the request was cancelled
      const session = await this.callSessionService.getSession(data.sessionId);
      if (session) {
        const astrologerSocketId = this.astrologerSockets.get(session.astrologerId.toString());
        if (astrologerSocketId) {
          this.server.to(astrologerSocketId).emit('call_request_cancelled', {
            sessionId: data.sessionId,
            reason: data.reason || 'User cancelled the request',
            timestamp: new Date()
          });
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`❌ [CallGateway] Cancel error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const data = Array.isArray(payload) ? payload[0] : payload;
    if (!data?.sessionId) return { success: false, message: 'Missing data' };

    client.join(data.sessionId);

    this.activeUsers.set(data.userId, {
      socketId: client.id,
      userId: data.userId,
      role: data.role,
      sessionId: data.sessionId
    });

    this.logger.log(`👥 ${data.role} (${data.userId}) joined call room: ${data.sessionId} via socket ${client.id}`);

    client.to(data.sessionId).emit('participant_joined', {
      userId: data.userId,
      role: data.role,
      isOnline: true
    });

    const session = await this.callSessionService.getSession(data.sessionId);
    if (session && session.status === 'accepted' && data.role === 'user') {
      this.logger.log(`🔄 [CallGateway] Resending call_accepted to late-joining user`);

      // Fetch astrologer details again to be safe
      const astrologer = await this.callSessionService['astrologerModel'].findById(session.astrologerId).select('name profilePicture').lean();

      client.emit('call_accepted', {
        sessionId: data.sessionId,
        orderId: session.orderId,
        callType: session.callType,
        ratePerMinute: session.ratePerMinute,
        astrologerId: session.astrologerId.toString(),
        astrologerName: astrologer?.name || 'Astrologer',
        astrologerImage: astrologer?.profilePicture,
        timestamp: session.acceptedAt?.toISOString(),
      });
    }

    await this.checkAndPrepareCredentials(data.sessionId);
    return { success: true };
  }

  @SubscribeMessage('sync_timer')
  async handleSyncTimer(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    this.logger.log(`🔄 [CallGateway] Sync timer requested for session: ${data.sessionId}`);
    const timerData = this.sessionTimerData.get(data.sessionId);
    
    if (timerData) {
      const remainingSeconds = Math.max(0, timerData.maxDurationSeconds - timerData.secondsElapsed);
      return {
        success: true,
        data: {
          remainingSeconds,
          maxDuration: timerData.maxDurationSeconds,
          secondsElapsed: timerData.secondsElapsed
        }
      };
    }

    // Fallback to DB if session is active but timer ticker was lost (e.g. partial restart)
    const session = await this.callSessionService.getSession(data.sessionId);
    if (session && session.status === 'active') {
      const now = new Date();
      const startedAt = session.startTime || session.acceptedAt || now;
      const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      const remainingSeconds = Math.max(0, session.maxDurationSeconds - elapsed);
      
      return {
        success: true,
        data: {
          remainingSeconds,
          maxDuration: session.maxDurationSeconds,
          secondsElapsed: elapsed
        }
      };
    }

    return { success: false, message: 'No active timer found' };
  }

  private async checkAndPrepareCredentials(sessionId: string) {
    const session = await this.callSessionService.getSession(sessionId);
    const participants = Array.from(this.activeUsers.values()).filter(u => u.sessionId === sessionId);
    const hasUser = participants.some(u => u.role === 'user');
    const hasAstrologer = participants.some(u => u.role === 'astrologer');

    if (hasUser && (hasAstrologer || session?.isAi)) {
      this.logger.log(`🔔 Parties ready for ${sessionId}. Sending credentials...`);
      await this.prepareCallCredentials(sessionId);
    }
  }

  // ✅ 2. Generates tokens and sends 'call_credentials', but DOES NOT start timer
  private async prepareCallCredentials(sessionId: string) {
    try {
      // Force fetch fresh from DB to avoid stale Mongoose cache for AI sessions
      const session = await this.callSessionService['sessionModel'].findOne({ sessionId }).exec();
      if (!session) throw new BadRequestException('Session not found');

      let isNew = false;
      if (!session.agoraChannelName) {
        session.agoraChannelName = this.agoraService.generateChannelName();
        isNew = true;
      }

      const channelName = session.agoraChannelName;
      // Reuse existing or generate new
      const userUid = session.agoraUserUid || this.agoraService.generateUid();
      const astrologerUid = session.agoraAstrologerUid || this.agoraService.generateUid();
      const userToken = session.agoraUserToken || this.agoraService.generateRtcToken(channelName, userUid, 'publisher');
      const astrologerToken = session.agoraAstrologerToken || this.agoraService.generateRtcToken(channelName, astrologerUid, 'publisher');

      if (isNew || !session.agoraUserToken) {
        session.agoraUserToken = userToken;
        session.agoraAstrologerToken = astrologerToken;
        session.agoraUserUid = userUid;
        session.agoraAstrologerUid = astrologerUid;
        await session.save();
      }

      const basePayload: any = {
        sessionId: sessionId,
        callType: session.callType,
        agoraAppId: this.agoraService.getAppId(),
        agoraChannelName: channelName,
        timestamp: new Date().toISOString(),
      };

      if (session.isAi && session.voiceProvider) {
        basePayload.provider = session.voiceProvider;
        if (session.voiceProvider === 'gemini') {
          basePayload.geminiConfig = session.aiConfig;
        } else if (session.voiceProvider === 'vapi') {
          basePayload.vapiConfig = session.aiConfig;
        }
      }

      // Send to User
      const userSocket = Array.from(this.activeUsers.values()).find(u => u.role === 'user' && u.sessionId === sessionId);
      if (userSocket) {
        this.server.to(userSocket.socketId).emit('call_credentials', {
          ...basePayload,
          agoraToken: userToken,
          agoraUid: userUid,
          agoraAstrologerUid: astrologerUid
        });
      }

      // Send to Astrologer
      const astroSocket = Array.from(this.activeUsers.values()).find(u => u.role === 'astrologer' && u.sessionId === sessionId);
      if (astroSocket) {
        this.server.to(astroSocket.socketId).emit('call_credentials', {
          ...basePayload,
          agoraToken: astrologerToken,
          agoraUid: astrologerUid,
          agoraUserUid: userUid
        });
      }

      // ✅ For AI sessions (Gemini & Vapi): timer starts ONLY when the client signals connection is ready.
      // Removed the auto-start here to avoid charging during the "Connecting..." phase.
      
    } catch (error) {
      this.logger.error(`Prepare credentials error: ${error.message}`);
    }
  }

  private async startCallInternal(sessionId: string) {
    try {
      const session = await this.callSessionService.getSession(sessionId);
      if (!session) throw new BadRequestException('Session not found');

      if (!session.agoraChannelName) {
        session.agoraChannelName = this.agoraService.generateChannelName();
        await session.save();
      }

      if (session.status === 'active') {
        this.logger.log(`Call ${sessionId} already active, resuming ticker...`);
        if (!this.sessionTimers.has(sessionId)) {
          this.startTimerTicker(sessionId, session.maxDurationSeconds);
        }
        return;
      }

      const result = await this.callSessionService.startSession(sessionId);

      const channelName = session.agoraChannelName;
      const userUid = this.agoraService.generateUid();
      const astrologerUid = this.agoraService.generateUid();
      const userToken = this.agoraService.generateRtcToken(channelName, userUid, 'publisher');
      const astrologerToken = this.agoraService.generateRtcToken(channelName, astrologerUid, 'publisher');

      session.agoraUserToken = userToken;
      session.agoraAstrologerToken = astrologerToken;
      session.agoraUserUid = userUid;
      session.agoraAstrologerUid = astrologerUid;
      session.recordingStarted = new Date();
      await session.save();

      let recordingStarted = false;
      try {
        const recordingUid = this.agoraService.generateUid();
        const recordingResult = await this.callRecordingService.startRecording(
          sessionId,
          session.callType as 'audio' | 'video',
          channelName,
          recordingUid,
        );
        this.activeRecordings.set(sessionId, recordingResult.recordingId);
        
        session.agoraResourceId = recordingResult.resourceId;
        session.agoraSid = recordingResult.recordingId;
        session.agoraRecordingUid = recordingUid;
        await session.save();

        recordingStarted = true;
      } catch (recErr) {
        this.logger.error(`Recording failed: ${recErr}`);
      }

      const basePayload = {
        sessionId: sessionId,
        maxDurationMinutes: result.data.maxDurationMinutes,
        maxDurationSeconds: result.data.maxDurationSeconds,
        ratePerMinute: result.data.ratePerMinute,
        callType: result.data.callType,
        chargingStarted: true,
        agoraAppId: this.agoraService.getAppId(),
        agoraChannelName: channelName,
        recordingStarted,
        timestamp: new Date().toISOString(),
      };

      const userSocket = Array.from(this.activeUsers.values()).find(u => u.role === 'user' && u.sessionId === sessionId);
      if (userSocket) this.server.to(userSocket.socketId).emit('timer_start', { ...basePayload, agoraToken: userToken, agoraUid: userUid });

      const astroSocket = Array.from(this.activeUsers.values()).find(u => u.role === 'astrologer' && u.sessionId === sessionId);
      if (astroSocket) this.server.to(astroSocket.socketId).emit('timer_start', { ...basePayload, agoraToken: astrologerToken, agoraUid: astrologerUid });

      this.startTimerTicker(sessionId, result.data.maxDurationSeconds);

    } catch (error) {
      this.logger.error(`Start call internal error: ${error.message}`);
    }
  }

  private stopSessionTimer(sessionId: string) {
    if (this.sessionTimers.has(sessionId)) {
      clearInterval(this.sessionTimers.get(sessionId)!);
      this.sessionTimers.delete(sessionId);
    }
    this.sessionTimerData.delete(sessionId);
  }

  private startTimerTicker(sessionId: string, maxDurationSeconds: number) {
    this.stopSessionTimer(sessionId);
    this.sessionTimerData.set(sessionId, { maxDurationSeconds, secondsElapsed: 0 });

    const ticker = setInterval(async () => {
      const data = this.sessionTimerData.get(sessionId);
      if (!data) {
        this.stopSessionTimer(sessionId);
        return;
      }

      const { maxDurationSeconds: currentMax, secondsElapsed } = data;

      if (secondsElapsed >= currentMax) {
        this.stopSessionTimer(sessionId);

        // Emit final 0 tick so apps don't get stuck at 1 second
        this.server.to(sessionId).emit('timer_tick', {
          elapsedSeconds: currentMax,
          remainingSeconds: 0,
          maxDuration: currentMax,
          formattedTime: '00:00',
          percentage: 100
        });

        await this.endCallInternal(sessionId, 'system', 'timeout');
        return;
      }

      const remainingSeconds = Math.max(0, currentMax - secondsElapsed);
      this.server.to(sessionId).emit('timer_tick', {
        elapsedSeconds: secondsElapsed,
        remainingSeconds,
        maxDuration: currentMax
      });

      if (remainingSeconds === 60) {
        this.server.to(sessionId).emit('timer_warning', {
          message: '1 minute remaining',
          remainingSeconds: 60
        });
      }

      this.sessionTimerData.set(sessionId, { ...data, secondsElapsed: secondsElapsed + 1 });
    }, 1000);

    this.sessionTimers.set(sessionId, ticker);
  }

  /**
   * Dynamically update the session timer (e.g., after recharge)
   */
  public updateSessionTimer(sessionId: string, newMaxDurationSeconds: number) {
    const data = this.sessionTimerData.get(sessionId);
    if (data) {
      this.sessionTimerData.set(sessionId, { ...data, maxDurationSeconds: newMaxDurationSeconds });
      this.logger.log(`⏲️ Updated timer for call session ${sessionId}: New Max Duration = ${newMaxDurationSeconds}s`);

      // Notify clients immediately
      const remainingSeconds = newMaxDurationSeconds - data.secondsElapsed;
      this.server.to(sessionId).emit('timer_updated', {
        sessionId,
        newMaxSeconds: newMaxDurationSeconds,
        newSecondsLeft: remainingSeconds,
        timestamp: new Date()
      });
    }
  }

  @SubscribeMessage('end_call')
  async handleEndCall(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string; endedBy: string; reason: string; transcript?: string }) {
    return await this.endCallInternal(data.sessionId, data.endedBy, data.reason, data.transcript);
  }

  private async endCallInternal(sessionId: string, endedBy: string, reason: string, transcript?: string): Promise<any> {
    if (this.processingEndCall.has(sessionId)) return { success: true };
    this.processingEndCall.add(sessionId);

    try {
      const timerData = this.sessionTimerData.get(sessionId);
      const secondsElapsed = timerData?.secondsElapsed || 0;
      this.stopSessionTimer(sessionId);

      // 1. Trigger Recording Stop in BACKGROUND (Fire-and-Forget)
      this.handleBackgroundRecordingStop(sessionId);
      this.activeRecordings.delete(sessionId);

      // 2. End Session IMMEDIATELY (Don't wait for recording)
      const result = await this.callSessionService.endSession(
        sessionId,
        endedBy,
        reason,
        undefined,
        undefined,
        0,
        transcript,
        secondsElapsed
      );

      const billedMinutes = result.data?.billedMinutes ?? 0;
      const totalAmount = result.data?.chargeAmount ?? 0;

      this.server.to(sessionId).emit('call_ended', {
        sessionId: sessionId,
        endedBy: endedBy,
        endTime: new Date(),
        actualDuration: result.data?.actualDuration || 0,
        billedMinutes: billedMinutes,
        chargeAmount: totalAmount,
        message: 'Call ended',
        billing: { totalAmount, billedMinutes }
      });

      return { success: true, message: 'Call ended', data: result.data };

    } catch (error) {
      this.logger.error(`Error in endCallInternal: ${error.message}`);
      return { success: false, message: error.message };
    } finally {
      this.processingEndCall.delete(sessionId);
    }
  }

  // ✅ BACKGROUND TASK
  private async handleBackgroundRecordingStop(sessionId: string) {
    try {
      const session = await this.callSessionService.getSession(sessionId);
      if (!session) return;

      const recResult = await this.callRecordingService.stopRecording(
        sessionId,
        session.agoraChannelName || '',
        session.agoraResourceId,
        session.agoraSid,
        session.agoraRecordingUid
      );

      if (recResult.recordingUrl) {
        await this.callSessionService.updateRecordingAfterEnd(
          sessionId,
          recResult.recordingUrl,
          recResult.recordingS3Key,
          recResult.recordingDuration
        );
      }
    } catch (e) {
      this.logger.error(`Background recording stop failed for ${sessionId}: ${e.message}`);
    }
  }

  public async terminateCall(sessionId: string, endedBy: string, reason: string) {
    return this.endCallInternal(sessionId, endedBy, reason);
  }

  public async cancelCallRequest(sessionId: string, userId: string, reason: string) {
    const result = await this.callSessionService.cancelCall(sessionId, userId, reason, 'user');
    
    // Notify room just in case someone is there
    this.server.to(sessionId).emit('call_cancelled', { sessionId, reason });
    
    // Notify the astrologer that the request was cancelled explicitly via their socket
    try {
      const session = await this.callSessionService.getSession(sessionId);
      if (session) {
        const astrologerSocketId = this.astrologerSockets.get(session.astrologerId.toString());
        if (astrologerSocketId) {
          this.server.to(astrologerSocketId).emit('call_request_cancelled', {
            sessionId: sessionId,
            reason: reason || 'User cancelled the request',
            timestamp: new Date()
          });
        }
      }
    } catch (e) {
      this.logger.error(`Error notifying astrologer of call cancellation: ${e.message}`);
    }
    
    return result;
  }

  public async notifyUserOfAcceptance(sessionId: string, astrologerId: string, data?: any) {
    const userData = Array.from(this.activeUsers.values()).find(u => u.sessionId === sessionId && u.role === 'user');

    if (userData) {
      // Use provided rich data, or fallback to basic IDs if missing
      const payload = data ? { ...data, sessionId, astrologerId } : { sessionId, astrologerId };

      this.server.to(userData.socketId).emit('call_accepted', payload);
      this.logger.log(`Notify User: Call accepted for ${sessionId} with rich data`);
    } else {
      this.logger.warn(`Notify User: User not found for session ${sessionId}`);
    }
  }

  public async notifyUserOfRejection(sessionId: string, astrologerId: string, reason: string) {
    const session = await this.callSessionService.getSession(sessionId);
    if (!session) return { success: false, message: 'Session not found' };

    const targetUserId = session.userId?.toString();

    this.logger.log(`🔍 [CallGateway] Notifying call rejected. Looking for user socket for targetUserId: ${targetUserId}`);
    this.logger.log(`🔍 [CallGateway] Current userSockets map keys: ${Array.from(this.userSockets.keys()).join(', ')}`);

    if (targetUserId) {
      const userSocketId = this.userSockets.get(targetUserId);
      if (userSocketId) {
        this.server.to(userSocketId).emit('call_rejected', { sessionId, reason });
        this.logger.log(`✅ [CallGateway] DIRECT send 'call_rejected' to user: ${targetUserId} at socket: ${userSocketId}`);
      } else {
        this.logger.warn(`⚠️ [CallGateway] User ${targetUserId} socket not found in global map for rejection`);
      }
    }
    return { success: true };
  }

  // ── Gemini Proxy Methods ──────────────────────────────────────────────────

  @SubscribeMessage('gemini_start')
  async handleGeminiStart(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    this.logger.log(`[CallGateway] gemini_start received for ${data.sessionId}`);
    try {
      const session = await this.callSessionService.getSession(data.sessionId);
      if (!session || !session.aiConfig || session.voiceProvider !== 'gemini') {
        return { success: false, message: 'Invalid Gemini session' };
      }

      const maxDurationSeconds = session.maxDurationSeconds;
      const ratePerMinute = session.ratePerMinute;
      const sessionId = data.sessionId;

      await this.geminiVoiceService.openSession(
        sessionId,
        client.id,
        session.aiConfig,
        (audio) => {
          this.server.to(sessionId).emit('gemini_audio_response', { audio });
        },
        () => {
          this.server.to(sessionId).emit('gemini_closed');
          // ✅ Capture transcript before ending
          const transcript = this.geminiVoiceService.getTranscript(sessionId);
          // ✅ Also ensure session is ended in DB if it hasn't been already
          this.endCallInternal(sessionId, 'system', 'gemini_closed_by_ai', transcript).catch(e => {
             this.logger.error(`Failed to end Gemini session on close: ${e.message}`);
          });
        },
        // ✅ onReady: Gemini setup_complete received — NOW start billing timer
        () => {
          this.logger.log(`✅ [Gemini] AI is ready for ${sessionId}. Starting billing timer NOW.`);
          if (!this.sessionTimers.has(sessionId)) {
            this.startTimerTicker(sessionId, maxDurationSeconds);
            this.server.to(sessionId).emit('timer_start', {
              sessionId,
              maxDurationSeconds,
              ratePerMinute,
              timestamp: new Date().toISOString(),
            });
          }
          // ✅ Also signal frontend that Gemini is fully connected and call is live
          this.server.to(sessionId).emit('gemini_ready', { sessionId });
        },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`[CallGateway] Failed to start Gemini session: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('gemini_audio')
  handleGeminiAudio(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string; audio: string }) {
    if (this.geminiVoiceService.hasSession(data.sessionId)) {
      this.geminiVoiceService.sendAudioChunk(data.sessionId, data.audio);
    }
  }

  @SubscribeMessage('gemini_stop')
  async handleGeminiStop(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    this.logger.log(`[CallGateway] gemini_stop received for ${data.sessionId}`);
    
    // 0. Capture transcript before closing
    const transcript = this.geminiVoiceService.getTranscript(data.sessionId);

    // 1. Close Gemini connection
    this.geminiVoiceService.closeSession(data.sessionId);
    
    // 2. End the database session and process billing
    return await this.endCallInternal(data.sessionId, 'user', 'user_ended_gemini', transcript);
  }

  @SubscribeMessage('vapi_start')
  async handleVapiStart(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string, vapiCallId?: string }) {
    this.logger.log(`[CallGateway] vapi_start received for ${data.sessionId}, VapiID=${data.vapiCallId}`);
    try {
      const session = await this.callSessionService.getSession(data.sessionId);
      if (!session || session.voiceProvider !== 'vapi') {
        return { success: false, message: 'Invalid Vapi session' };
      }

      if (data.vapiCallId) {
         await this.callSessionService.updateSessionData(data.sessionId, { vapiCallId: data.vapiCallId });
      }

      if (!this.sessionTimers.has(data.sessionId)) {
        this.logger.log(`✅ [Vapi] AI is ready for ${data.sessionId}. Starting billing timer NOW.`);
        this.startTimerTicker(data.sessionId, session.maxDurationSeconds);
        
        this.server.to(data.sessionId).emit('timer_start', {
          sessionId: data.sessionId,
          maxDurationSeconds: session.maxDurationSeconds,
          ratePerMinute: session.ratePerMinute,
          timestamp: new Date().toISOString()
        });
      }
      
      return { success: true };
    } catch (error) {
      this.logger.error(`[CallGateway] Failed to start Vapi timer: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('vapi_end')
  async handleVapiEnd(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    this.logger.log(`[CallGateway] vapi_end received for ${data.sessionId}. Stopping ticker.`);
    try {
      const timerData = this.sessionTimerData.get(data.sessionId);
      if (timerData) {
        // Save the current duration to DB as a robust fallback before stopping ticker
        await this.callSessionService.updateSessionData(data.sessionId, { duration: timerData.secondsElapsed });
      }
      this.stopSessionTimer(data.sessionId);
      return { success: true };
    } catch (error) {
      this.logger.error(`[CallGateway] Failed to stop Vapi timer: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

}