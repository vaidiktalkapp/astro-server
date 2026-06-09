import { Controller, Get, Param, Query, Req, UseGuards, DefaultValuePipe, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiChatSessionService } from '../services/chat-session.service';

@Controller('ai-history')
@UseGuards(JwtAuthGuard)
export class AiHistoryController {
    constructor(private readonly chatSessionService: AiChatSessionService) { }

    @Get()
    async getHistory(
        @Req() req: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('type') type: 'chat' | 'call' = 'chat'
    ) {
        const userId = req.user.userId;
        const result = await this.chatSessionService.getAiChatHistory(userId, page, limit, type);

        return {
            success: true,
            data: {
                history: result.history,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    pages: Math.ceil(result.total / limit)
                }
            }
        };
    }

    @Get(':orderId')
    async getOrderDetails(@Param('orderId') orderId: string, @Req() req: any) {
        const userId = req.user.userId;
        // orderId matches either sessionId or orderId field
        const session = await this.chatSessionService.getSessionDetails(orderId, userId);

        if (!session) {
            throw new NotFoundException('AI Chat session not found');
        }

        return {
            success: true,
            data: session
        };
    }
}
