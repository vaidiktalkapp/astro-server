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
      // 1. Clean up active calls (both AI and Human)
      const activeSessions = await this.callModel.find({ 
        status: 'active'
      });

      for (const session of activeSessions) {
        let shouldEnd = false;
        let reason = session.isAi ? 'ai_stale_timeout' : 'system_stale_timeout';

        const startTime = session.startTime || session.createdAt;
        const totalDuration = (now.getTime() - startTime.getTime()) / 1000;
        
        // Safety check 1: If call exceeded its allowed balance time (+ 60s grace)
        if (session.maxDurationSeconds > 0 && totalDuration > (session.maxDurationSeconds + 60)) {
            shouldEnd = true;
            reason = 'max_duration_reached_cleanup';
        }
        
        // Safety check 2: Check offline status
        if (session.isAi) {
          const lastSeenTime = session.userStatus?.lastSeen?.getTime() || (session.startTime || session.createdAt).getTime();
          const isUserOffline = !session.userStatus?.isOnline && 
                              (lastSeenTime < (now.getTime() - 90 * 1000)); // 1.5 minutes
          
          if (isUserOffline) {
            shouldEnd = true;
            reason = 'ai_user_offline_cleanup';
          }
        } else {
          // Human calls: check if EITHER user or astrologer has been offline for > 1.5 minutes (90s)
          const userLastSeen = session.userStatus?.lastSeen?.getTime() || startTime.getTime();
          const astroLastSeen = session.astrologerStatus?.lastSeen?.getTime() || startTime.getTime();
          
          const isUserOffline = !session.userStatus?.isOnline && (now.getTime() - userLastSeen > 90 * 1000);
          const isAstroOffline = !session.astrologerStatus?.isOnline && (now.getTime() - astroLastSeen > 90 * 1000);

          if (isUserOffline && isAstroOffline) {
            shouldEnd = true;
            reason = 'both_offline_cleanup';
          } else if (isUserOffline) {
            shouldEnd = true;
            reason = 'user_offline_cleanup';
          } else if (isAstroOffline) {
            shouldEnd = true;
            reason = 'astrologer_offline_cleanup';
          }
        }

        if (shouldEnd) {
          this.logger.warn(`[Cleanup] Ending stale active Call: ${session.sessionId} | Reason: ${reason}`);
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
      // 1. Clean up ALL active chats
      const activeChats = await this.chatModel.find({
        status: 'active'
      });

      for (const chat of activeChats) {
        const lastActivity = chat.lastMessageAt || chat.updatedAt || chat.createdAt;
        const inactivityDuration = now.getTime() - new Date(lastActivity).getTime();
        
        const isAi = chat.orderId?.startsWith('AI-');

        // If no message for 2 minutes, end the chat to save balance
        if (inactivityDuration > 2 * 60 * 1000) {
          this.logger.warn(`[Cleanup] Ending inactive Chat: ${chat.sessionId}`);
          await this.chatSessionService.endSession(chat.sessionId, 'system', isAi ? 'ai_inactivity_timeout' : 'human_inactivity_timeout');
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
