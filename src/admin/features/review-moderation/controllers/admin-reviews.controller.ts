import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req
} from '@nestjs/common';
import { AdminReviewModerationService } from '../services/admin-reviews.service';
import { AdminAuthGuard } from '../../../core/guards/admin-auth.guard';
import { PermissionsGuard } from '../../../core/guards/permissions.guard';
import { RequirePermissions } from '../../../core/decorators/permissions.decorator';
import { Permissions } from '../../../core/config/permissions.config';
import { Types } from 'mongoose';

@Controller('admin/reviews')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminReviewsController {
  constructor(
    private readonly adminReviewsModerationService: AdminReviewModerationService
  ) { }

  // Get reviews for moderation
  @Get()
  @RequirePermissions(Permissions.REVIEWS_VIEW)
  async getReviews(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status: any = 'pending',
  ) {
    return this.adminReviewsModerationService.getReviewsForModeration(+page, +limit, status);
  }

  // Get moderation stats
  @Get('stats')
  @RequirePermissions(Permissions.REVIEWS_VIEW)
  async getStats() {
    return this.adminReviewsModerationService.getModerationStats();
  }

  // Approve review
  @Patch(':id/approve')
  @RequirePermissions(Permissions.REVIEWS_MANAGE)
  async approveReview(@Param('id') id: string, @Req() req) {
    const adminId = req.admin?._id || req.user?.userId;
    return this.adminReviewsModerationService.approveReview(
      id,
      new Types.ObjectId(adminId)
    );
  }

  // Reject review
  @Patch(':id/reject')
  @RequirePermissions(Permissions.REVIEWS_MANAGE)
  async rejectReview(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { reason: string },
  ) {
    const adminId = req.admin?._id || req.user?.userId;
    return this.adminReviewsModerationService.rejectReview(
      id,
      new Types.ObjectId(adminId),
      body.reason,
    );
  }

  // Flag review
  @Patch(':id/flag')
  @RequirePermissions(Permissions.REVIEWS_MANAGE)
  async flagReview(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { reason: string },
  ) {
    const adminId = req.admin?._id || req.user?.userId;
    return this.adminReviewsModerationService.flagReview(
      id,
      new Types.ObjectId(adminId),
      body.reason,
    );
  }
}
