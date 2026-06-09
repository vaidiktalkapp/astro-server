import { Controller, Post, Body, UseGuards, Req, Get, Query } from '@nestjs/common';
import { ChatMessageFeedbackService } from '../services/chat-message-feedback.service';
import { CreateChatMessageFeedbackDto } from '../dto/create-chat-message-feedback.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('chat/feedback')
@UseGuards(JwtAuthGuard)
export class ChatMessageFeedbackController {
  constructor(private readonly feedbackService: ChatMessageFeedbackService) {}

  @Post()
  async createFeedback(@Req() req: any, @Body() dto: CreateChatMessageFeedbackDto) {
    const userId = req.user._id || req.user.userId;
    return this.feedbackService.createFeedback(userId, dto);
  }

  @Get('analytics')
  async getAnalytics(@Query('astrologerId') astrologerId?: string) {
    return this.feedbackService.getAnalytics(astrologerId);
  }
}
