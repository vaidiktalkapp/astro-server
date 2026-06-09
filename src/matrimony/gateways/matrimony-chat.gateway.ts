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
import { Logger } from '@nestjs/common';
import { MatrimonyChatService } from '../services/matrimony-chat.service';

interface AuthSocket extends Socket {
  handshake: Socket['handshake'] & {
    auth?: {
      token?: string;
      userId?: string;
    };
  };
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://vaidik-web.netlify.app',
      'https://vaidiktalk-ai-2.vercel.app',
      'https://vaidiktalkweb.vercel.app',
      'https://admin.vaidiktalk.com',
      'https://app.vaidiktalk.com',
      'https://web-vaidik-main.vercel.app',
      'https://admin-portal-rho-two.vercel.app',
      'https://admin-portal-9x2pjk4h9-rajkumaryadav2749s-projects.vercel.app'
    ],
    credentials: true,
  },
  namespace: '/matrimony-chat',
})
export class MatrimonyChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatrimonyChatGateway.name);
  private userSockets = new Map<string, string>(); // userId -> socketId

  constructor(private matrimonyChatService: MatrimonyChatService) {}

  handleConnection(client: AuthSocket) {
    const userId = client.handshake.auth?.userId;
    if (userId) {
      this.userSockets.set(userId, client.id);
      this.logger.log(`✅ Matrimony Chat user connected: ${userId}`);
    }
  }

  handleDisconnect(client: AuthSocket) {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`Matrimony Chat user disconnected: ${userId}`);
        break;
      }
    }
  }

  @SubscribeMessage('join_match_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interestId: string; userId: string }
  ) {
    const userId = (client as any).handshake.auth?.userId || data.userId;
    
    this.logger.log(`📥 User ${userId} joining match room: ${data.interestId} | Socket: ${client.id}`);
    const roomId = String(data.interestId);
    client.join(roomId);

    // Mark messages as read
    this.matrimonyChatService.markAsRead(roomId, userId).catch(err =>
      this.logger.error(`❌ Failed to mark messages as read for room ${roomId}`, err)
    );

    const order = await this.matrimonyChatService.getActiveOrder(userId, roomId);
    
    this.logger.log(`📊 Quota check for user ${userId} in room ${roomId}: ${order ? (order.totalMessages - order.messagesUsed) : 0} messages remaining`);

    // We emit the quota status back to the exact client who joined
    client.emit('chat_quota_status', {
      hasActiveQuota: !!order,
      remainingMessages: order ? (order.totalMessages - order.messagesUsed) : 0,
    });

    return { success: true };
  }

  @SubscribeMessage('send_matrimony_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interestId: string; senderId: string; content: string }
  ) {
    try {
      const senderId = (client as any).handshake.auth?.userId || data.senderId;
      const roomId = String(data.interestId);
      
      this.logger.log(`📤 Message from ${senderId} in room ${roomId}: "${data.content.substring(0, 20)}..."`);
      
      const result = await this.matrimonyChatService.sendMessage(
        roomId,
        senderId,
        data.content
      );

      const message = result.message;

      // Broadcast to room
      this.logger.log(`📢 Broadcasting message ${message._id} to room ${roomId}`);
      this.server.to(roomId).emit('receive_matrimony_message', {
        messageId: message._id,
        interestId: roomId,
        senderId: senderId,
        content: message.content,
        sentAt: message.sentAt,
      });

      // Emit back to the sender their updated quota
      client.emit('chat_quota_status', {
        hasActiveQuota: result.remainingMessages > 0,
        remainingMessages: result.remainingMessages,
      });

      return { success: true };
    } catch (error: any) {
      if (error.message === 'QUOTA_EXHAUSTED') {
        client.emit('chat_quota_exhausted', {
          interestId: data.interestId,
          message: 'Your message pack is empty. Please recharge to continue chatting.',
        });
        return { success: false, message: 'QUOTA_EXHAUSTED' };
      }
      this.logger.error(`❌ Send matrimony message error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('purchase_confirmed')
  async handlePurchaseConfirmed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interestId: string; userId: string; remainingMessages: number }
  ) {
    const userId = (client as any).handshake.auth?.userId || data.userId;
    
    // Notify room that this user unlocked the chat
    this.server.to(data.interestId).emit('chat_unlocked_by_user', {
      interestId: data.interestId,
      purchasedBy: userId,
    });
    
    // Update proper client with their new quota
    client.emit('chat_quota_status', {
      hasActiveQuota: true,
      remainingMessages: data.remainingMessages,
    });
  }
}
