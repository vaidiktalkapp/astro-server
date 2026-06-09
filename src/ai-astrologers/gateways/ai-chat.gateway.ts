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
import { Logger, NotFoundException, BadRequestException, UsePipes, ValidationPipe } from '@nestjs/common';
import { AiChatSessionService } from '../services/chat-session.service';
import { AiAstrologyEngineService } from '../services/ai-astrology-engine.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../schemas/ai-astrologers-profile.schema';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';

interface AuthSocket extends Socket {
    handshake: Socket['handshake'] & {
        auth?: {
            token?: string;
            userId?: string;
            role?: string;
        };
    };
}

@WebSocketGateway({
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://localhost:3005', 'http://localhost:5173', 'https://vaidik-web.netlify.app', 'https://vaidiktalk-ai-2-1a2t.vercel.app', 'https://vaidiktalk-ai-2.vercel.app', 'https://vaidik-admin.netlify.app', 'https://vaidiktalk-ai.vercel.app', 'https://vaidiktalkweb.vercel.app', 'https://vaidiktalkaiadmin.vercel.app', 'https://web-vaidik-main.vercel.app', 'https://admin-portal-rho-two.vercel.app', 'https://admin-portal-9x2pjk4h9-rajkumaryadav2749s-projects.vercel.app'],
        credentials: true,
        methods: ['GET', 'POST'],
    },
    namespace: '/ai-chat',
})
export class AiChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AiChatGateway.name);
    private activeUsers = new Map<string, { socketId: string; userId: string; sessionId?: string }>();
    private sessionTimers = new Map<string, NodeJS.Timeout>();
    private disconnectTimers = new Map<string, NodeJS.Timeout>();
    private socketToSession = new Map<string, string>();

    constructor(
        private readonly aiChatSessionService: AiChatSessionService,
        private readonly aiEngineService: AiAstrologyEngineService,
        @InjectModel(AiAstrologerProfile.name) private aiProfileModel: Model<AiAstrologerProfileDocument>,
    ) { }

    handleConnection(client: AuthSocket) {
        this.logger.log(`AI Chat client connected: ${client.id}`);
        const { userId } = client.handshake.auth || {};

        if (userId) {
            this.logger.log(`User ${userId} connected to AI chat`);
        }
    }

    handleDisconnect(client: AuthSocket) {
        this.logger.log(`AI Chat client disconnected: ${client.id}`);

        const sessionId = this.socketToSession.get(client.id);
        if (sessionId) {
            this.logger.log(`Session ${sessionId} marked for auto-end if user doesn't reconnect in 5s`);

            if (this.disconnectTimers.has(sessionId)) {
                clearTimeout(this.disconnectTimers.get(sessionId));
            }

            const timer = setTimeout(async () => {
                this.logger.log(`Grace period expired for session ${sessionId}. Ending session due to inactivity/disconnect.`);
                try {
                    const session = await this.aiChatSessionService.endSession(sessionId, undefined, 'auto_disconnect');
                    if (session) {
                        this.notifySessionEnded(session, 'auto_disconnect');
                    }
                    this.disconnectTimers.delete(sessionId);
                    this.stopTimerTicker(sessionId);
                } catch (e) {
                    this.logger.error(`Failed to auto-end session ${sessionId}:`, e);
                }
            }, 5000);

            this.disconnectTimers.set(sessionId, timer);
            this.socketToSession.delete(client.id);
        }

        for (const [userId, userData] of this.activeUsers.entries()) {
            if (userData.socketId === client.id) {
                this.activeUsers.delete(userId);
                break;
            }
        }
    }

    @SubscribeMessage('join_ai_chat')
    async handleJoinAiChat(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {
            sessionId: string;
            orderId?: string;
            userId: string;
        }
    ) {
        try {
            const sessionId = data.sessionId || data.orderId;
            if (!sessionId) throw new BadRequestException('Missing sessionId or orderId');

            this.logger.log(`🤖 join_ai_chat: User ${data.userId} joining session ${sessionId}`);

            const session = await this.aiChatSessionService.getSession(sessionId);
            if (!session) {
                throw new NotFoundException('AI chat session not found');
            }

            if (session.userId.toString() !== data.userId) {
                throw new BadRequestException('Unauthorized to join this session');
            }

            client.join(sessionId);
            if (session.orderId && session.orderId !== sessionId) {
                client.join(session.orderId);
            }

            this.activeUsers.set(data.userId, {
                socketId: client.id,
                userId: data.userId,
                sessionId: sessionId
            });

            this.socketToSession.set(client.id, sessionId);

            if (this.disconnectTimers.has(sessionId)) {
                this.logger.log(`User reconnected to session ${sessionId}. Cancelling auto-end timer.`);
                clearTimeout(this.disconnectTimers.get(sessionId));
                this.disconnectTimers.delete(sessionId);
            }

            if (session.status === 'active' && !this.sessionTimers.has(sessionId)) {
                const maxDuration = session.maxDurationSeconds || 3600;
                this.startTimerTicker(sessionId, maxDuration);
            }

            return {
                success: true,
                message: 'Joined AI chat session',
                data: {
                    sessionId: sessionId,
                    timestamp: new Date()
                }
            };
        } catch (error: any) {
            this.logger.error(`❌ join_ai_chat error: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    @UsePipes(new ValidationPipe({ transform: true }))
    @SubscribeMessage('send_ai_message')
    async handleSendAiMessage(@ConnectedSocket() client: Socket, @MessageBody() data: SendAiMessageDto) {
        const { sessionId, message, userId } = data;
        this.logger.log(`📥 [AI Gateway] Received send_ai_message: Session=${sessionId}, User=${userId}, MsgLength=${message?.length}`);

        try {
            if (!sessionId || !message || !userId) {
                this.logger.warn(`⚠️ [AI Gateway] Missing required fields: sessionId=${sessionId}, message=${message ? 'exists' : 'null'}, userId=${userId}`);
                return { success: false, message: 'Missing required fields' };
            }

            let chatSession = await this.aiChatSessionService.getSession(sessionId);
            if (!chatSession) {
                throw new NotFoundException('AI chat session not found');
            }

            const aiProfile = await this.aiProfileModel.findById(chatSession.astrologerId);

            if (chatSession.userId.toString() !== userId) {
                throw new BadRequestException('Unauthorized');
            }

            if (chatSession.status === 'ended') {
                throw new BadRequestException('Session has ended');
            }

            // Save user message
            const { session: currentSession } = await this.aiChatSessionService.saveMessage(
                sessionId,
                message,
                'user',
                userId
            );

            chatSession = currentSession;

            // ✅ TRIGGER: Dynamic greeting based on intake details
            const isIntakeMessage = message.includes("Below are my consultation details:") || 
                                    (message.includes("Gender:") && message.includes("Date of Birth:") && message.includes("Place of Birth:"));
            
            if (isIntakeMessage) {
                this.logger.log(`✨ [GREETING] Triggered for session ${sessionId}`);

                // Emit typing indicator
                this.server.to(sessionId).emit('ai_typing', {
                    sessionId: sessionId,
                    orderId: sessionId,
                    isTyping: true,
                    timestamp: new Date()
                });

                const shouldProceed = await this.aiChatSessionService.markGreetingGenerated(sessionId);
                if (shouldProceed) {
                    const userName = chatSession.userBirthChart?.name || 'Seeker';
                    const aiProfile = await this.aiProfileModel.findById(chatSession.astrologerId);
                    const greeting = await this.aiEngineService.generateDynamicGreeting(userName, chatSession.language || 'English', aiProfile);

                    const { message: greetingMessage, session: updatedSession2 } = await this.aiChatSessionService.saveMessage(sessionId, greeting, 'astrologer', chatSession.astrologerId.toString());

                    const greetingPayload = {
                        _id: (greetingMessage as any)._id.toString(),
                        messageId: greetingMessage.messageId,
                        sessionId: sessionId,
                        orderId: chatSession.orderId || sessionId,
                        senderId: chatSession.astrologerId.toString(),
                        senderModel: 'AiAstrologerProfile',
                        receiverId: userId,
                        receiverModel: 'User',
                        type: 'text',
                        content: greeting,
                        message: greeting,
                        deliveryStatus: 'sent',
                        sentAt: new Date(),
                        threadId: sessionId,
                        isAi: true,
                        isGreeting: true
                    };

                    // Stop typing indicator
                    this.server.to(sessionId).emit('ai_typing', {
                        sessionId: sessionId,
                        orderId: sessionId,
                        isTyping: false,
                        timestamp: new Date()
                    });

                    this.logger.log(`📡 Sending Greeting to ${sessionId}: ${greeting.substring(0, 30)}...`);
                    this.server.to(sessionId).emit('ai_message', greetingPayload);
                    this.server.to(sessionId).emit('new_message', greetingPayload);
                    this.server.to(sessionId).emit('chat_message', greetingPayload);

                    // UPDATE STATS for Greeting
                    const defaultGreetingAccuracy = 95;
                    const baselineLatency = 2.0;

                    await this.aiChatSessionService.updateProfilePerformanceStats(
                        chatSession.astrologerId.toString(),
                        baselineLatency,
                        defaultGreetingAccuracy
                    );

                    updatedSession2.avgLatency = baselineLatency;
                    updatedSession2.avgAccuracy = defaultGreetingAccuracy;
                    await (updatedSession2 as any).save();

                    return { success: true, message: 'Greeting triggered' };
                } else {
                    // It's a duplicate intake message (e.g. from page reload). 
                    // Ignore it to prevent the AI from generating an unprompted reading!
                    this.logger.warn(`Duplicate intake message received for session ${sessionId}. Ignoring.`);
                    return { success: true, message: 'Duplicate intake message ignored' };
                }
            }

            // Normal AI response path
            this.server.to(sessionId).emit('ai_typing', {
                sessionId: sessionId,
                orderId: sessionId,
                isTyping: true,
                timestamp: new Date()
            });

            const userBirthDetails = {
                name: chatSession.userBirthChart?.name || 'User',
                dateOfBirth: chatSession.userBirthChart?.dateOfBirth || '2000-01-01',
                timeOfBirth: chatSession.userBirthChart?.timeOfBirth || '12:00',
                placeOfBirth: chatSession.userBirthChart?.placeOfBirth || 'India',
            };

            const astrologerProfile = {
                name: aiProfile?.name || 'Astrologer',
                gender: aiProfile?.gender || 'male', // Added gender
                tone: aiProfile?.tone,
                styleGuide: aiProfile?.styleGuide,
                personalityType: aiProfile?.personalityType,
                systemPromptAddition: aiProfile?.systemPromptAddition,
                expertise: aiProfile?.expertise,
                bio: aiProfile?.bio,
                focusArea: aiProfile?.focusArea
            };

            const history = await this.aiChatSessionService.getRecentMessages(sessionId, 10);

            const startTime = Date.now();
            const aiResponse = await this.aiEngineService.generateResponse(
                message,
                astrologerProfile,
                userBirthDetails,
                history,
                chatSession.language || 'English'
            );
            const latencySeconds = (Date.now() - startTime) / 1000;

            let accuracy = 80;
            const metricsMatch = aiResponse.match(/\[\[METRICS: ACCURACY=(\d+), EMPATHY=(\d+)\]\]/i);
            if (metricsMatch) {
                accuracy = parseInt(metricsMatch[1]) * 10;
            } else {
                accuracy = this.aiEngineService.calculateQualityScore(aiResponse) * 10;
            }

            const cleanResponseRaw = aiResponse?.replace(/\[\[METRICS:.*?\]\]/gi, '')?.trim();

            // Split response into highly granular "cards" (bubbles) as requested.
            // Split by:
            // 1. Double newlines (paragraphs)
            // 2. Start of a bullet point line (*, -, or •)
            // 3. Start of a numbered line (1., 2., etc.)
            // We use lookahead to keep the bullet/number in the next part.
            const responseParts = cleanResponseRaw
                .split(/\n\s*\n|(?=\n\s*[-*•]\s+)|(?=\n\s*\d+\.\s+[A-Z])/)
                .map(p => p.trim())
                .filter(Boolean);

            for (const part of responseParts) {
                const cleanPart = part;

                const { message: aiMessage, session: updatedSession3 } = await this.aiChatSessionService.saveMessage(
                    sessionId,
                    cleanPart,
                    'astrologer',
                    chatSession.astrologerId.toString()
                );

                const currentMsgCount = updatedSession3.messageCount || 1;
                updatedSession3.avgLatency = (((updatedSession3.avgLatency || 0) * (currentMsgCount - 1)) + latencySeconds) / currentMsgCount;
                updatedSession3.avgAccuracy = (((updatedSession3.avgAccuracy || 0) * (currentMsgCount - 1)) + accuracy) / currentMsgCount;
                await (updatedSession3 as any).save();

                const standardPayload = {
                    _id: (aiMessage as any)._id.toString(),
                    messageId: aiMessage.messageId,
                    sessionId: sessionId,
                    orderId: chatSession.orderId || sessionId,
                    senderId: chatSession.astrologerId.toString(),
                    senderModel: 'AiAstrologerProfile',
                    receiverId: userId,
                    receiverModel: 'User',
                    type: 'text',
                    content: cleanPart,
                    message: cleanPart,
                    deliveryStatus: 'sent',
                    sentAt: new Date(),
                    threadId: sessionId,
                    isAi: true
                };

                this.logger.log(`📡 Sending AI Bubble to ${sessionId}: ${cleanPart.substring(0, 30)}...`);
                this.server.to(sessionId).emit('ai_message', standardPayload);
                this.server.to(sessionId).emit('new_message', standardPayload);
                this.server.to(sessionId).emit('chat_message', standardPayload);

            }

            this.server.to(sessionId).emit('ai_typing', {
                sessionId: sessionId,
                orderId: sessionId,
                isTyping: false,
                timestamp: new Date()
            });

            try {
                const suggestions = await this.aiEngineService.suggestFollowUps(
                    history,
                    aiProfile,
                    chatSession.userBirthChart,
                    chatSession.language || 'English'
                );
                this.server.to(sessionId).emit('suggestions', suggestions);
            } catch (sugErr) {
                this.logger.error(`Error generating suggestions: ${sugErr.message}`);
            }

            return { success: true, message: 'Message sent and AI response generated' };
        } catch (error: any) {
            this.logger.error(`❌ send_ai_message error: ${error.message}`);
            this.server.to(sessionId).emit('ai_typing', {
                sessionId: sessionId,
                orderId: sessionId,
                isTyping: false,
                timestamp: new Date()
            });
            this.server.to(sessionId).emit('chat_error', {
                sessionId: sessionId,
                orderId: sessionId,
                message: 'Celestial connection lost. Please try again.',
                error: error.message
            });
            return { success: false, message: error.message };
        }
    }

    @SubscribeMessage('leave_ai_chat')
    async handleLeaveAiChat(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; userId: string }
    ) {
        const sessionId = data.sessionId;
        if (!sessionId) return { success: false, message: 'Missing sessionId' };
        client.leave(sessionId);
        this.activeUsers.delete(data.userId);
        this.socketToSession.delete(client.id);
        this.stopTimerTicker(sessionId);
        return { success: true, message: 'Left AI chat session' };
    }

    @SubscribeMessage('end_ai_chat')
    async handleEndAiChat(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; userId: string; rating?: number }
    ) {
        const sessionId = data.sessionId;
        if (!sessionId) return { success: false, message: 'Missing sessionId' };

        try {
            const session = await this.aiChatSessionService.endSession(sessionId, data.userId, 'user_ended', data.rating);
            if (session) {
                this.stopTimerTicker(sessionId); // Stop the timer immediately
                this.notifySessionEnded(session, 'user_ended');
                client.leave(sessionId);
                this.activeUsers.delete(data.userId);
                this.socketToSession.delete(client.id);
            }
            return { success: true, message: 'AI chat session ended' };
        } catch (error: any) {
            this.logger.error(`❌ end_ai_chat error: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    notifySessionEnded(session: any, reason: string = 'ended') {
        if (!this.server || !session) return;
        const sessionId = session.sessionId.toString();
        const payload = {
            sessionId: sessionId,
            orderId: session.orderId || sessionId,
            totalCost: session.totalCost,
            duration: session.duration,
            status: 'ended',
            reason: reason,
            timestamp: new Date()
        };
        this.server.to(sessionId).emit('session_ended', payload);
        if (session.orderId && session.orderId !== sessionId) {
            this.server.to(session.orderId).emit('session_ended', payload);
        }
    }

    private async startTimerTicker(sessionId: string, maxDurationSeconds: number) {
        const initialSession = await this.aiChatSessionService.getSession(sessionId);
        const startTime = initialSession?.startTime || new Date();
        let secondsElapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);

        if (this.sessionTimers.has(sessionId)) {
            clearInterval(this.sessionTimers.get(sessionId)!);
        }

        const ticker = setInterval(async () => {
            const remainingSeconds = maxDurationSeconds - secondsElapsed;
            if (remainingSeconds <= 2) {
                clearInterval(ticker);
                this.sessionTimers.delete(sessionId);
                try {
                    const session = await this.aiChatSessionService.endSession(sessionId, undefined, 'low_balance');
                    if (session) this.notifySessionEnded(session, 'low_balance');
                } catch (error) {
                    this.logger.error(`Auto-end AI chat error: ${error}`);
                }
                return;
            }

            const session = await this.aiChatSessionService.getSession(sessionId);
            const rate = session?.ratePerMinute || 0;
            const currentCost = Math.ceil((secondsElapsed / 60) * rate);

            let walletBalance = 0;
            if (session?.userId) {
                const user = await this.aiChatSessionService.getUser(session.userId.toString());
                walletBalance = user?.wallet?.balance || 0;
            }

            const timerUpdatePayload = {
                sessionId: sessionId,
                orderId: session?.orderId || sessionId,
                duration: secondsElapsed,
                remainingSeconds: remainingSeconds,
                walletBalance: walletBalance,
                currentCost: currentCost,
                status: 'active',
                timestamp: new Date()
            };

            this.server.to(sessionId).emit('timer_update', timerUpdatePayload);
            if (session?.orderId && session.orderId !== sessionId) {
                this.server.to(session.orderId).emit('timer_update', timerUpdatePayload);
            }
            secondsElapsed++;
        }, 1000);

        this.sessionTimers.set(sessionId, ticker);
    }

    private stopTimerTicker(sessionId: string) {
        if (this.sessionTimers.has(sessionId)) {
            clearInterval(this.sessionTimers.get(sessionId));
            this.sessionTimers.delete(sessionId);
        }
    }
}
