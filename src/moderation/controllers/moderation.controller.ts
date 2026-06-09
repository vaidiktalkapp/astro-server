import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModerationService } from '../services/moderation.service';

@Controller('common') // Matches frontend route: /common/report
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('report')
  async reportAbuse(@Req() req, @Body() body: any) {
    const reporterId = req.user.userId;
    const role = req.user.role; // Assuming JWT has role ('user' or 'astrologer')
    
    // Determine Reporter Model based on role
    const reporterModel = role === 'astrologer' ? 'Astrologer' : 'User';

    if (!body.reportedUserId || !body.reason) {
      throw new BadRequestException('Reported User ID and Reason are required');
    }

    return this.moderationService.createReport({
      reporterId,
      reporterModel,
      reportedUserId: body.reportedUserId,
      entityType: body.entityType || 'general',
      entityId: body.entityId, // e.g., session ID
      reason: body.reason,
      description: body.description,
    });
  }
}