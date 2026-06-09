import { Controller, Post, Body, UseGuards, Req, BadRequestException, Get, Param, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AstrologerBlockingService } from '../services/astrologer-blocking.service';

@Controller('astrologer') // Matches frontend route: /astrologer/block-user
@UseGuards(JwtAuthGuard)
export class AstrologerBlockingController {
  constructor(private readonly blockingService: AstrologerBlockingService) {}

  // ─── Global Block (Chat + Call + Stream) ───────────────────────
  @Post('block-user')
  async blockUser(@Req() req, @Body() body: { userId: string; reason?: string }) {
    const astrologerId = req.user.userId;
    
    if (!body.userId) {
      throw new BadRequestException('User ID is required');
    }

    return this.blockingService.blockUser(astrologerId, body.userId, body.reason);
  }

  @Delete('unblock-user/:userId')
  async unblockUser(@Req() req, @Param('userId') userId: string) {
    const astrologerId = req.user.userId;
    return this.blockingService.unblockUser(astrologerId, userId);
  }

  @Get('blocked-users')
  async getBlockedUsers(@Req() req) {
    const astrologerId = req.user.userId;
    return this.blockingService.getBlockedUsers(astrologerId);
  }

  // ─── Stream-Only Block (Chat & Call still allowed) ─────────────
  @Post('stream-block-user')
  async streamBlockUser(@Req() req, @Body() body: { userId: string; reason?: string }) {
    const astrologerId = req.user.userId;

    if (!body.userId) {
      throw new BadRequestException('User ID is required');
    }

    return this.blockingService.blockUserFromStream(astrologerId, body.userId, body.reason);
  }

  @Delete('stream-unblock-user/:userId')
  async streamUnblockUser(@Req() req, @Param('userId') userId: string) {
    const astrologerId = req.user.userId;
    return this.blockingService.unblockUserFromStream(astrologerId, userId);
  }

  @Get('stream-blocked-users')
  async getStreamBlockedUsers(@Req() req) {
    const astrologerId = req.user.userId;
    return this.blockingService.getStreamBlockedUsers(astrologerId);
  }
}