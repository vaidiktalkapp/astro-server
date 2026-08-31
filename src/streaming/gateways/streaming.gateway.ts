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
import { StreamSessionService } from '../services/stream-session.service';
import { AstrologerBlockingService } from '../../astrologers/services/astrologer-blocking.service'; // Check path
import { Inject, forwardRef } from '@nestjs/common';

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
    credentials: true,
  },
  namespace: '/stream',
  transports: ['websocket', 'polling'],
})
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string> = new Map();
  private streamHosts: Map<string, string> = new Map();
  private socketToStream: Map<string, string> = new Map();
  private streamHeartbeats: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @Inject(forwardRef(() => StreamSessionService))
    private streamSessionService: StreamSessionService,
    private blockingService: AstrologerBlockingService
  ) { }

  handleConnection(client: Socket) {
    console.log('====================================');
    console.log('✅ NEW CLIENT CONNECTED');
    console.log('Socket ID:', client.id);
    console.log('Handshake Query:', client.handshake.query);
    console.log('Handshake Auth:', client.handshake.auth);
    console.log('====================================');

  }

  async handleDisconnect(client: Socket) {
    console.log('====================================');
    console.log('❌ CLIENT DISCONNECTED');
    console.log('Socket ID:', client.id);
    console.log('Timestamp:', new Date().toISOString());
    console.log('====================================');

    // ✅ Find userId from socketId
    let disconnectedUserId: string | null = null;
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      console.log(`📝 Disconnected User ID: ${disconnectedUserId}`);

      // Remove from user sockets
      this.userSockets.delete(disconnectedUserId);
      console.log(`🗑️ User socket removed from registry`);
      console.log(`📊 Remaining mapped users: ${this.userSockets.size}`);

      // Handle user disconnect (if on call)
      try {
        await this.streamSessionService.handleUserDisconnect(disconnectedUserId);
      } catch (err) {
        console.error('❌ Error handling user disconnect:', err);
      }
    }

    // ✅ Check if this was a host
    const streamId = this.socketToStream.get(client.id);

    if (streamId) {
      console.log('🔴 HOST DISCONNECTED - ENDING STREAM');
      console.log('Stream ID:', streamId);

      const hostUserId = this.streamHosts.get(streamId);

      if (hostUserId) {
        try {
          await this.streamSessionService.endStream(streamId, hostUserId);

          this.server.to(streamId).emit('stream_ended', {
            reason: 'Host disconnected',
            timestamp: new Date().toISOString(),
          });

          console.log('✅ Stream automatically ended');
        } catch (error) {
          console.error('❌ Error ending stream:', error);
        }

        this.streamHosts.delete(streamId);
      }

      this.socketToStream.delete(client.id);

      // Clear heartbeat timeout
      if (this.streamHeartbeats.has(streamId)) {
        clearTimeout(this.streamHeartbeats.get(streamId));
        this.streamHeartbeats.delete(streamId);
      }
    }

    console.log('====================================\n');
  }



  /**
    * Notify host of call request
    * ✅ FIX: Accept hostId directly to avoid cache misses
    */
  notifyCallRequest(
    streamId: string,
    hostId: string, // <--- ADDED PARAMETER
    data: {
      userId: string;
      userName: string;
      userAvatar: string | null;
      callType: 'voice' | 'video';
      callMode: 'public' | 'private';
      position: number;
    }
  ) {
    console.log('📞 ===== NOTIFYING HOST OF CALL REQUEST =====');
    console.log('📞 Stream ID:', streamId);
    console.log('📞 Host ID:', hostId);

    // 1. Try finding socket via Host ID directly (More reliable)
    let hostSocketId = this.userSockets.get(hostId.toString());

    // 2. Fallback to stream-host map if direct lookup fails
    if (!hostSocketId) {
      console.warn('⚠️ Host socket not found via ID, trying stream map...');
      const mappedHostId = this.streamHosts.get(streamId);
      if (mappedHostId) {
        hostSocketId = this.userSockets.get(mappedHostId);
      }
    }

    if (!hostSocketId) {
      console.error('❌ Host is OFFLINE (No active socket found for hostId):', hostId);
      return;
    }

    console.log('📡 Emitting event to Host Socket:', hostSocketId);

    this.server.to(hostSocketId).emit('call_request_received', {
      streamId,
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar,
      callType: data.callType,
      callMode: data.callMode,
      position: data.position,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== STREAM EVENTS ====================

  /**
   * Join stream room
   */
  @SubscribeMessage('join_stream')
  async handleJoinStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      userId: string;
      userName: string;
      isHost?: boolean;
    }
  ) {
    console.log('====================================');
    console.log('📺 JOIN_STREAM EVENT RECEIVED');
    console.log('Socket ID:', client.id);
    console.log('User ID:', data.userId);
    console.log('User Name:', data.userName);
    console.log('Is Host:', !!data.isHost);
    console.log('Stream ID:', data.streamId);
    console.log('====================================');

    if (!data.userId || data.userId === 'undefined' || data.userId === 'null') {
      console.error('❌ REJECTED JOIN: Invalid User ID');
      return { success: false, error: 'Invalid User ID' };
    }

    // ✅ CHECK STREAM-BLOCK BEFORE JOINING (chat/call not affected)
    if (!data.isHost) { // Only check viewers
      const stream = await this.streamSessionService.getStreamById(data.streamId);
      if (stream) {
        const isStreamBlocked = await this.blockingService.isUserStreamBlocked(stream.hostId.toString(), data.userId);
        if (isStreamBlocked) {
          console.log(`🚫 Stream-blocked user ${data.userId} tried to join stream ${data.streamId}`);
          client.emit('error', { message: 'You have been blocked from this astrologer\'s live streams' });
          return { success: false, error: 'StreamBlocked' };
        }
      }
    }

    // ✅ CRITICAL: map userId → socketId for ALL users
    this.userSockets.set(data.userId, client.id);
    console.log(`✅ USER SOCKET MAPPED: ${data.userId} → ${client.id}`);
    console.log('📋 Current userSockets:', Array.from(this.userSockets.entries()));

    client.join(data.streamId);
    console.log(`✅ Socket ${client.id} joined room: ${data.streamId}`);

    if (data.isHost) {
      this.streamHosts.set(data.streamId, data.userId);
      this.socketToStream.set(client.id, data.streamId);
      console.log('🎬 HOST REGISTERED FOR STREAM', data.streamId);
    } else {
      console.log('👤 VIEWER REGISTERED:', data.userId, 'socket:', client.id);
    }

    client.to(data.streamId).emit('viewer_joined', {
      userId: data.userId,
      userName: data.userName,
      timestamp: new Date(),
    });

    return { success: true };
  }

  /**
   * Leave stream room
   */
  @SubscribeMessage('leave_stream')
  async handleLeaveStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; userId: string; userName: string }
  ) {
    client.leave(data.streamId);

    await this.streamSessionService.leaveStream(data.streamId, data.userId);

    client.to(data.streamId).emit('viewer_left', {
      userId: data.userId,
      userName: data.userName,
      timestamp: new Date()
    });

    return { success: true };
  }

  // ==================== CHAT EVENTS ====================

  /**
   * Send comment/message
   */
  @SubscribeMessage('send_comment')
  async handleSendComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      userId: string;
      userName: string;
      userAvatar?: string;
      comment: string
    }
  ) {
    // ✅ Check stream-block before allowing comment (chat/call not affected)
    let hostUserId = this.streamHosts.get(data.streamId);
    if (!hostUserId) {
      try {
        const stream = await this.streamSessionService.getStreamById(data.streamId);
        if (stream) {
          hostUserId = stream.hostId.toString();
        }
      } catch (e) {
        console.error('Error fetching stream for comment stream-block check:', e);
      }
    }

    if (hostUserId) {
      const isStreamBlocked = await this.blockingService.isUserStreamBlocked(hostUserId, data.userId);
      if (isStreamBlocked) {
        console.log(`🚫 Prevented stream-blocked user ${data.userId} from commenting on stream ${data.streamId}`);
        client.emit('error', { message: 'You have been blocked from this astrologer\'s live streams' });
        return { success: false, error: 'StreamBlocked' };
      }
    }

    // Broadcast to all viewers
    this.server.to(data.streamId).emit('new_comment', {
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar,
      comment: data.comment,
      timestamp: new Date()
    });

    // Update analytics
    await this.streamSessionService.updateStreamAnalytics(data.streamId, {
      incrementComments: 1
    });

    return { success: true };
  }

  /**
   * NEW: Astrologer blocks/kicks an abusive viewer from the live session in real-time
   */
  @SubscribeMessage('kick_user')
  async handleKickUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; userId: string; reason?: string }
  ) {
    console.log(`🚫 [Host Control] Kicking user ${data.userId} from stream ${data.streamId}`);

    // Find stream host ID
    let hostUserId = this.streamHosts.get(data.streamId);
    if (!hostUserId) {
      try {
        const stream = await this.streamSessionService.getStreamById(data.streamId);
        if (stream) {
          hostUserId = stream.hostId.toString();
        }
      } catch (e) {
        console.error('Error fetching stream for host verification:', e);
      }
    }

    if (!hostUserId) {
      return { success: false, error: 'Stream or Host not found' };
    }

    // ✅ Stream-only block — user can still chat/call this astrologer
    try {
      await this.blockingService.blockUserFromStream(hostUserId, data.userId, data.reason || 'Kicked from live stream due to policy violation');
    } catch (err) {
      console.warn(`Stream blocking notice (might already be stream-blocked):`, err.message);
    }

    // Find target user's active socket
    const targetSocketId = this.userSockets.get(data.userId);
    if (targetSocketId) {
      const targetSocket = this.server.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        // Emit kicked event directly to the abuser so their app forces them out
        targetSocket.emit('kicked_from_stream', {
          reason: data.reason || 'You have been blocked by the astrologer.',
          streamId: data.streamId
        });

        // Force socket to leave the Socket.io room
        targetSocket.leave(data.streamId);
        console.log(`✅ Socket for user ${data.userId} successfully kicked and removed from room`);
      }
    }

    // Broadcast to all other viewers in the stream that this user has been kicked
    this.server.to(data.streamId).emit('viewer_kicked', {
      userId: data.userId,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  }

  // ==================== USER CONTROL EVENTS (NEW) ====================

  /**
   * ✅ NEW: Handle User Cancelling Call Request
   * Syncs with Host UI to remove request immediately
   */
  @SubscribeMessage('cancel_call_request')
  async handleCancelCallRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; userId: string }
  ) {
    console.log(`❌ [User Control] Cancel Request: ${data.userId} for stream ${data.streamId}`);

    const hostUserId = this.streamHosts.get(data.streamId);
    if (hostUserId) {
      const hostSocketId = this.userSockets.get(hostUserId);
      if (hostSocketId) {
        // ✅ FIXED: Add await
        await this.streamSessionService.cancelCallRequest(data.streamId, data.userId);

        // Notify Host specifically
        this.server.to(hostSocketId).emit('call_request_cancelled', {
          userId: data.userId,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ Cancel request processed for user ${data.userId}`);
      } else {
        console.error(`❌ Host socket not found for stream ${data.streamId}`);
      }
    } else {
      console.error(`❌ Host not registered for stream ${data.streamId}`);
    }

    return { success: true };
  }

  /**
   * ✅ NEW: Handle User Ending Call
   * Syncs with Host to end call and Viewers to revert layout
   */
  @SubscribeMessage('user_end_call')
  async handleUserEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; userId: string }
  ) {
    console.log(`📞 [User Control] User Ended Call: ${data.userId} on stream ${data.streamId}`);

    // 1. Notify Host immediately
    const hostUserId = this.streamHosts.get(data.streamId);
    if (hostUserId) {
      const hostSocketId = this.userSockets.get(hostUserId);
      if (hostSocketId) {
        this.server.to(hostSocketId).emit('user_ended_call', {
          userId: data.userId,
          timestamp: new Date().toISOString()
        });
      }

      // Ensure backend session is closed
      try {
        await this.streamSessionService.endUserCall(data.streamId, data.userId);
      } catch (e) {
        console.error('Error ending call session on DB', e);
      }
    }

    // 2. Notify all viewers that call is over (to revert split screen)
    this.server.to(data.streamId).emit('call_ended', {
      duration: 0,
      charge: 0,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  }

  // ==================== CALL EVENTS ====================

  /**
   * Call request received
   */
  @SubscribeMessage('call_requested')
  handleCallRequested(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      userId: string;
      userName: string;
      userAvatar?: string;
      callType: 'voice' | 'video';
      callMode: 'public' | 'private';
      position: number;
    }
  ) {
    // Notify host
    this.server.to(data.streamId).emit('call_request_received', {
      userId: data.userId,
      userName: data.userName,
      userAvatar: data.userAvatar,
      callType: data.callType,
      callMode: data.callMode,
      position: data.position,
      timestamp: new Date()
    });

    return { success: true };
  }

  /**
   * Call accepted - FIXED VERSION WITH TYPE SAFETY
   */
  @SubscribeMessage('call_accepted')
  async handleCallAccepted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      userId: string;
      userName: string;
      callType: 'voice' | 'video';
      callMode: 'public' | 'private';
      callerAgoraUid: number;
    }
  ) {
    try {
      console.log('====================================');
      console.log('✅ CALL ACCEPTED EVENT (GATEWAY)');
      console.log('Stream ID:', data.streamId);
      console.log('User ID:', data.userId);
      console.log('====================================');

      // ✅ Get the caller's socket ID
      const callerSocketId = this.userSockets.get(data.userId);

      console.log('📝 Found caller socket:', callerSocketId);

      // Default values mapping
      let maxDuration = data['maxDuration'] || 3600;
      let finalUid = data.callerAgoraUid;

      if (callerSocketId) {
        // ✅ Send FULL credentials to the specific caller directly from payload
        // The API has already called acceptCallRequest and populated these fields
        const callCredentials = {
          streamId: data.streamId,
          userId: data.userId,
          userName: data.userName,
          callType: data.callType,
          callMode: data.callMode,
          callerAgoraUid: data.callerAgoraUid,
          channelName: data['channelName'] || data['agoraChannelName'], // Fallback for safety
          token: data['token'] || data['agoraToken'],
          uid: data.callerAgoraUid, // Usually same as callerAgoraUid
          appId: data['appId'] || process.env.AGORA_APP_ID || '203397a168f8469bb8e672cd15eb3eb6',
          hostAgoraUid: data['hostAgoraUid'],
          maxDuration: maxDuration,
        };

        console.log('====================================');
        console.log('📡 SENDING CALL CREDENTIALS TO CALLER');
        console.log('To Socket:', callerSocketId);
        console.log('Channel:', callCredentials.channelName);
        console.log('Caller UID:', callCredentials.callerAgoraUid);
        console.log('====================================');

        // ✅ Send to SPECIFIC caller with credentials
        this.server.to(callerSocketId).emit('call_accepted', callCredentials);

        console.log('✅ Call credentials sent to caller');
      } else {
        console.error('❌ Caller socket not found for user:', data.userId);
      }

      // ✅ Broadcast to ALL viewers (for split-screen display)
      this.server.to(data.streamId).emit('call_started', {
        userId: data.userId,
        userName: data.userName,
        callType: data.callType,
        callMode: data.callMode,
        callerAgoraUid: finalUid,
        maxDuration: maxDuration,
        timestamp: new Date()
      });

      console.log('✅ Call started broadcast to all viewers');
      console.log('====================================');

      return { success: true };
    } catch (error) {
      console.error('====================================');
      console.error('❌ CALL ACCEPTED ERROR');
      console.error('Error:', error);
      console.error('====================================');
      return { success: false, message: error.message };
    }
  }


  /**
  * Reject call request
  */
  @SubscribeMessage('call_rejected')
  handleCallRejected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      userId: string;
    }
  ) {
    console.log('====================================');
    console.log('❌ HOST REJECTED CALL');
    console.log('Stream ID:', data.streamId);
    console.log('Rejected User ID:', data.userId);
    console.log('====================================');

    // ✅ Get user's socket ID from the map
    const userSocketId = this.userSockets.get(data.userId);

    console.log('📝 User socket map:', Array.from(this.userSockets.entries()));
    console.log('📝 Looking for user:', data.userId);
    console.log('📝 Found socket ID:', userSocketId);

    if (userSocketId) {
      // ✅ Emit DIRECTLY to the user's socket
      this.server.to(userSocketId).emit('call_request_rejected', {
        streamId: data.streamId,
        userId: data.userId,
        reason: 'Host declined your request',
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Rejection sent to socket:', userSocketId);
    } else {
      console.error('❌ User socket not found!');
    }

    return { success: true };
  }

  /**
  * Call ended - FIXED VERSION
  */
  @SubscribeMessage('call_ended')
  handleCallEnded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      duration: number;
      charge: number;
    }
  ) {
    console.log('====================================');
    console.log('📞 CALL ENDED EVENT');
    console.log('Stream ID:', data.streamId);
    console.log('Duration:', data.duration);
    console.log('====================================');



    // ✅ Emit BOTH events for compatibility
    this.server.to(data.streamId).emit('call_ended', {
      duration: data.duration,
      charge: data.charge,
      timestamp: new Date().toISOString()
    });

    this.server.to(data.streamId).emit('call_finished', {
      duration: data.duration,
      charge: data.charge,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Call ended events emitted to all viewers');


    return { success: true };
  }


  // ==================== HOST CONTROL EVENTS ====================


  /**
   * Stream state changed
   */
  @SubscribeMessage('stream_state_changed')
  handleStreamStateChanged(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      state: 'streaming' | 'on_call' | 'idle';
    }
  ) {
    this.server.to(data.streamId).emit('stream_state_updated', {
      state: data.state,
      timestamp: new Date()
    });

    return { success: true };
  }

  /**
   * Viewer count updated
   */
  @SubscribeMessage('update_viewer_count')
  handleUpdateViewerCount(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; count: number }
  ) {
    this.server.to(data.streamId).emit('viewer_count_updated', {
      count: data.count,
      timestamp: new Date()
    });
  }

  /**
   * Waitlist updated
   */
  @SubscribeMessage('waitlist_updated')
  handleWaitlistUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      waitlist: any[];
    }
  ) {
    this.server.to(data.streamId).emit('call_waitlist_updated', {
      waitlist: data.waitlist,
      timestamp: new Date()
    });

    return { success: true };
  }

  // ==================== ADMIN EVENTS ====================

  /**
   * Force end stream (admin)
   */
  @SubscribeMessage('admin_end_stream')
  handleAdminEndStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      streamId: string;
      reason: string;
    }
  ) {
    this.server.to(data.streamId).emit('stream_force_ended', {
      reason: data.reason,
      timestamp: new Date()
    });

    return { success: true };
  }

  @SubscribeMessage('stream_heartbeat')
  handleStreamHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string }
  ) {
    console.log('💓 Heartbeat received for stream:', data.streamId);

    // Clear existing timeout
    if (this.streamHeartbeats.has(data.streamId)) {
      clearTimeout(this.streamHeartbeats.get(data.streamId));
    }

    // Set new timeout - if no heartbeat in 30 seconds, end stream
    const timeout = setTimeout(async () => {
      console.log('⚠️ No heartbeat received - ending stream:', data.streamId);

      const hostUserId = this.streamHosts.get(data.streamId);
      if (hostUserId) {
        try {
          await this.streamSessionService.endStream(data.streamId, hostUserId);

          this.server.to(data.streamId).emit('stream_ended', {
            reason: 'Connection lost',
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error ending stream:', error);
        }

        this.streamHosts.delete(data.streamId);
        this.streamHeartbeats.delete(data.streamId);
      }
    }, 30000); // 30 seconds

    this.streamHeartbeats.set(data.streamId, timeout);

    return { success: true };
  }

  public notifyCallEnded(streamId: string, duration: number, charge: number) {
    console.log(`📢 Emitting call_ended for stream ${streamId}`);
    this.server.to(streamId).emit('call_ended', {
      streamId,
      duration,
      charge,
      timestamp: new Date().toISOString()
    });
  }

  public notifyGiftSent(
    streamId: string,
    data: {
      userId: string;
      userName: string;
      userAvatar: string | null;
      giftName: string;
      amount: number;
      giftType: string;
    }
  ) {
    console.log(`📢 Broadcasting GIFT for stream ${streamId}`);
    this.server.to(streamId).emit('new_gift', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

}
