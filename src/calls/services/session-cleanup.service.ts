import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CallSessionService } from './call-session.service';
import { ChatSessionService } from '../../chat/services/chat-session.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallSession, CallSessionDocument } from '../schemas/call-session.schema';
import { ChatSession, ChatSessionDocument } from '../../chat/schemas/chat-session.schema';
import { AvailabilityService } from '../../astrologers/services/availability.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly callSessionService: CallSessionService,
    private readonly chatSessionService: ChatSessionService,
    private readonly availabilityService: AvailabilityService,
    @InjectModel(CallSession.name) private callModel: Model<CallSessionDocument>,
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSessionDocument>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupStaleSessions() {
    this.logger.log('🧹 [SessionCleanupService] Checking for stale call and chat sessions...');
    await Promise.all([
      this.cleanupCalls(),
      this.cleanupChats(),
    ]);
  }

  private async cleanupCalls() {
    const now = new Date();

    try {
      // 1. ONLY Clean up active AI calls
      const activeAiSessions = await this.callModel.find({ 
        status: 'active',
        isAi: true 
      });

      for (const session of activeAiSessions) {
        let shouldEnd = false;
        let reason = 'ai_stale_timeout';

        // AI Logic: End if user is offline for too long or if max duration reached
        const startTime = session.startTime || session.createdAt;
        const totalDuration = (now.getTime() - startTime.getTime()) / 1000;
        
        // Safety check 1: If call exceeded its allowed balance time (+ 60s grace)
        if (session.maxDurationSeconds > 0 && totalDuration > (session.maxDurationSeconds + 60)) {
            shouldEnd = true;
            reason = 'ai_max_duration_reached_cleanup';
        }
        
        // Safety check 2: If user has been offline for more than 3 minutes
        const isUserOffline = !session.userStatus?.isOnline && 
                            (!session.userStatus?.lastSeen || session.userStatus.lastSeen.getTime() < (now.getTime() - 3 * 60 * 1000));
        
        if (isUserOffline) {
          shouldEnd = true;
          reason = 'ai_user_offline_cleanup';
        }

        if (shouldEnd) {
          this.logger.warn(`[AI Cleanup] Ending stale active AI Call: ${session.sessionId} | Reason: ${reason}`);
          await this.callSessionService.endSession(session.sessionId, 'system', reason);
        }
      }

      // 2. Clean up initiated AI requests that were never accepted (e.g. server crash)
      const hangingAiRequests = await this.callModel.find({
        status: 'initiated',
        isAi: true,
        requestCreatedAt: { $lt: new Date(now.getTime() - 5 * 60 * 1000) }
      });

      for (const req of hangingAiRequests) {
        this.logger.warn(`[AI Cleanup] Cancelling hung AI request: ${req.sessionId}`);
        await this.callModel.updateOne({ sessionId: req.sessionId }, { 
          status: 'cancelled', 
          endReason: 'ai_request_timeout', 
          endTime: new Date(),
          endedBy: 'system'
        });
      }

      // 3. Clean up ALL hanging regular requests (initiated / waiting) that are older than 5 minutes
      // This prevents old requests from showing up when astrologer opens the app after server restart
      const hangingHumanCalls = await this.callModel.find({
        status: { $in: ['initiated', 'waiting'] },
        isAi: { $ne: true },
        requestCreatedAt: { $lt: new Date(now.getTime() - 5 * 60 * 1000) }
      });

      for (const req of hangingHumanCalls) {
        this.logger.warn(`[Cleanup] Cancelling hung human call request: ${req.sessionId}`);
        await this.callModel.updateOne({ sessionId: req.sessionId }, { 
          status: 'cancelled', 
          endReason: 'system_timeout_cleanup', 
          endTime: new Date(),
          endedBy: 'system'
        });
        
        // Also free up astrologer availability
        if (req.astrologerId) {
          await this.availabilityService.setAvailable(req.astrologerId.toString()).catch(() => {});
        }
      }

    } catch (e: any) {
      this.logger.error(`Error during AI Call cleanup: ${e.message}`);
    }
  }

  private async cleanupChats() {
    const now = new Date();

    try {
      // ONLY Clean up active AI chats
      const activeAiChats = await this.chatModel.find({
        status: 'active',
        orderId: /^AI-/ // AI chats always start with AI-
      });

      for (const chat of activeAiChats) {
        const lastActivity = chat.lastMessageAt || chat.updatedAt || chat.createdAt;
        const inactivityDuration = now.getTime() - new Date(lastActivity).getTime();
        
        // If no message for 15 minutes, end the AI chat
        if (inactivityDuration > 15 * 60 * 1000) {
          this.logger.warn(`[AI Cleanup] Ending inactive AI Chat: ${chat.sessionId}`);
          await this.chatSessionService.endSession(chat.sessionId, 'system', 'ai_inactivity_timeout');
        }
      }

      // 2. Clean up ALL hanging regular chat requests (initiated / waiting) that are older than 5 minutes
      // This prevents old chat requests from showing up when astrologer opens the app after server restart
      const hangingHumanChats = await this.chatModel.find({
        status: { $in: ['initiated', 'waiting'] },
        orderId: { $not: /^AI-/ }, // not AI chats
        requestCreatedAt: { $lt: new Date(now.getTime() - 5 * 60 * 1000) }
      });

      for (const req of hangingHumanChats) {
        this.logger.warn(`[Cleanup] Cancelling hung human chat request: ${req.sessionId}`);
        await this.chatModel.updateOne({ sessionId: req.sessionId }, { 
          status: 'cancelled', 
          endReason: 'system_timeout_cleanup', 
          endTime: new Date(),
          endedBy: 'system'
        });
        
        // Also free up astrologer availability
        if (req.astrologerId) {
          await this.availabilityService.setAvailable(req.astrologerId.toString()).catch(() => {});
        }
      }
    } catch (e: any) {
      this.logger.error(`Error during AI Chat cleanup: ${e.message}`);
    }
  }
}
