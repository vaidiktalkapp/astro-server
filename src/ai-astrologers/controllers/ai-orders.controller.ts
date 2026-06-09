import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    DefaultValuePipe,
    ParseIntPipe,
    ValidationPipe,
    NotFoundException,
    Delete,
    Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiChatSessionService } from '../services/chat-session.service';
import { AiAstrologyEngineService } from '../services/ai-astrology-engine.service';
import { AiChatGateway } from '../gateways/ai-chat.gateway';
import { StartAiChatDto } from '../dto/start-ai-chat.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../schemas/ai-astrologers-profile.schema';
import { ChatSession, ChatSessionDocument } from '../../chat/schemas/chat-session.schema';

@Controller('ai-orders')
@UseGuards(JwtAuthGuard)
export class AiOrdersController {
    private readonly logger = new Logger(AiOrdersController.name);
    constructor(
        private readonly chatSessionService: AiChatSessionService,
        private readonly aiEngineService: AiAstrologyEngineService,
        private readonly aiChatGateway: AiChatGateway,
        @InjectModel(AiAstrologerProfile.name) private aiProfileModel: Model<AiAstrologerProfileDocument>,
        @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
    ) { }

    @Post('ai')
    async initiateAiChat(@Body(ValidationPipe) dto: StartAiChatDto, @Req() req: any) {
        const userId = req.user.userId;

        const aiProfile = await this.aiProfileModel.findById(dto.astrologerId);
        if (!aiProfile) {
            throw new NotFoundException('AI Astrologer not found');
        }

        // 1. Start session instantly
        const session = await this.chatSessionService.startSession(userId, dto);

        this.logger.log(`✅ [initiateAiChat] Created session: ${session.sessionId}, orderId: ${session.orderId}`);

        // 2. Save user's initial intake message
        // 2. Optimization: Do not save "Starting Divine Consultation" as a message.
        // If the user provided a custom message, save it. Otherwise start empty.
        if (dto.message && dto.message !== 'Starting Divine Consultation') {
            await this.chatSessionService.saveMessage(session.sessionId, dto.message, 'user', userId);
        }

        // Initial greeting is now triggered via Socket when the frontend sends "Below are my details:"
        this.logger.log(`✅ [initiateAiChat] Session created for session ${session.sessionId}. Waiting for intake trigger.`);

        // IMPORTANT: Return orderId as the primary identifier for frontend navigation
        return {
            success: true,
            data: {
                _id: session.orderId, // Primary ID for navigation (format: AI-[timestamp])
                orderId: session.orderId, // Explicit orderId field
                sessionId: session.sessionId, // UUID for internal use
                status: session.status || 'active',
                session // Full session object for additional data
            }
        };
    }


    @Get('ai')
    async getAiHistory(
        @Req() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('type') type: 'chat' | 'call' = 'chat'
    ) {
        const userId = req.user.userId;
        const result = await this.chatSessionService.getAiChatHistory(userId, page, limit, type);

        return {
            success: true,
            data: result.history,
            pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) }
        };
    }

    @Post('fix-identity-migration')
    async fixIdentityMigration() {
        this.logger.log('🚀 Starting AI identity migration...');

        // 1. Fix AI Sessions (those with orderId starting with AI-)
        const sessionResult = await this.sessionModel.updateMany(
            { orderId: /^AI-/, astrologerModel: { $exists: false } },
            { $set: { astrologerModel: 'AiAstrologerProfile' } }
        );

        // 2. Fix Human Sessions
        const humanSessionResult = await this.sessionModel.updateMany(
            { orderId: { $not: /^AI-/ }, astrologerModel: { $exists: false } },
            { $set: { astrologerModel: 'Astrologer' } }
        );

        // 3. Fix Message Model for AI messages (where sender is not User)
        // We look for messages in AI sessions where senderId is the astrologer
        // Note: For simplicity, we just set the model on the session first.

        this.logger.log(`✅ Migration completed. AI Sessions: ${sessionResult.modifiedCount}, Human Sessions: ${humanSessionResult.modifiedCount}`);

        return {
            success: true,
            summary: {
                aiSessionsUpdated: sessionResult.modifiedCount,
                humanSessionsUpdated: humanSessionResult.modifiedCount
            }
        };
    }

    @Get('ai/:orderId')
    async getAiOrderDetails(@Param('orderId') sessionId: string, @Req() req: any) {
        const userId = req.user.userId;

        // Enhanced logging
        console.log('\n\n================ AI ORDER DEBUG ================');
        console.log(`🔍 Request for Session: '${sessionId}'`);
        console.log(`👤 User ID from Token: '${userId}'`);
        console.log(`📋 SessionId type: ${typeof sessionId}, length: ${sessionId?.length}`);

        this.logger.log(`🔍 [getAiOrderDetails] Fetching AI Order: ID=${sessionId}, User=${userId}`);

        const session = await this.chatSessionService.getSessionDetails(sessionId, userId);

        if (!session) {
            console.error(`❌ Session lookup returned NULL for ${sessionId}`);
            this.logger.error(`❌ [getAiOrderDetails] AI Chat session not found for ID=${sessionId} and User=${userId}`);
            throw new NotFoundException('AI Chat session not found');
        }

        console.log(`✅ Session FOUND: ${session.sessionId}, orderId: ${session.orderId}`);
        console.log('================================================\n\n');

        return {
            success: true,
            data: session
        };
    }

    @Post('ai/:orderId/end')
    @Put('ai/:orderId/end') // Added Put support for frontend compatibility
    async endAiChat(@Param('orderId') orderId: string, @Req() req: any, @Body() body: { reason?: string, rating?: number }) {
        const userId = req.user.userId;
        const result = await this.chatSessionService.endSession(orderId, userId, body.reason || 'user_ended', body.rating);

        if (!result) {
            throw new NotFoundException('AI Chat session not found or unauthorized');
        }

        // Notify via Socket if gateway is available
        this.aiChatGateway.notifySessionEnded(result, body.reason || 'user_ended');

        return {
            success: true,
            message: 'AI Chat session ended',
            data: result
        };
    }

    @Delete('ai/:id')
    async deleteAiHistory(@Param('id') id: string, @Req() req: any) {
        const userId = req.user.userId;
        const success = await this.chatSessionService.deleteSession(id, userId);
        if (!success) {
            throw new NotFoundException('History record not found or unauthorized');
        }
        return { success: true, message: 'History deleted successfully' };
    }
}
