import { Controller, Get, Post, Patch, Body, UseGuards, Req, Query, Param } from '@nestjs/common';
import { MatrimonyService } from '../services/matrimony.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../../admin/core/guards/admin-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Matrimony')
@Controller('matrimony')
@ApiBearerAuth()
export class MatrimonyController {
  constructor(private readonly matrimonyService: MatrimonyService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create or update current user matrimony profile' })
  async updateProfile(@Req() req: any, @Body() body: any) {
    const data = await this.matrimonyService.createOrUpdateProfile(req.user.userId, body);
    return { success: true, data };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user matrimony profile' })
  async getProfile(@Req() req: any) {
    try {
        const data = await this.matrimonyService.getProfile(req.user.userId);
        return { success: true, data };
    } catch (err) {
        return { success: true, data: null }; // Profile doesn't exist yet
    }
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get astrological match suggestions' })
  async getSuggestions(@Req() req: any, @Query('limit') limit?: number, @Query('location') location?: string) {
    const data = await this.matrimonyService.getSuggestions(req.user.userId, limit, location);
    return { success: true, data };
  }

  @Get('match/:otherUserId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get detailed matching report with a specific partner' })
  async getMatchDetails(@Req() req: any, @Param('otherUserId') otherUserId: string) {
    const data = await this.matrimonyService.getMatchDetails(req.user.userId, otherUserId);
    return { success: true, data };
  }

  // --- INTEREST & CONNECTION ROUTES ---

  @Post('interests/:receiverId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send interest to another user' })
  async sendInterest(@Req() req: any, @Param('receiverId') receiverId: string) {
    const data = await this.matrimonyService.sendInterest(req.user.userId, receiverId);
    return { success: true, data };
  }

  @Patch('interests/:requestId/response')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept or reject an interest request' })
  async handleInterestResponse(
    @Req() req: any, 
    @Param('requestId') requestId: string, 
    @Body('status') status: 'accepted' | 'rejected'
  ) {
    const data = await this.matrimonyService.handleInterestResponse(req.user.userId, requestId, status);
    return { success: true, data };
  }

  @Get('interests/:type')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get incoming or outgoing interest requests' })
  async getInterests(@Req() req: any, @Param('type') type: 'incoming' | 'outgoing') {
    const data = await this.matrimonyService.getInterests(req.user.userId, type);
    return { success: true, data };
  }

  // --- Admin Routes (use AdminAuthGuard for admin JWT) ---
  @Get('admin/profiles')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin: Get all matrimony profiles' })
  async getAdminProfiles(
    @Query('page') page?: number, 
    @Query('limit') limit?: number, 
    @Query('search') search?: string
  ) {
    const data = await this.matrimonyService.getAllProfilesForAdmin(
      Number(page) || 1, 
      Number(limit) || 20, 
      search
    );
    return { success: true, data };
  }

  @Patch('admin/profiles/:userId/status')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin: Toggle profile active status (ban/unban)' })
  async toggleProfileStatus(
    @Param('userId') userId: string, 
    @Body('isActive') isActive: boolean
  ) {
    const data = await this.matrimonyService.toggleProfileStatus(userId, isActive);
    return { success: true, data };
  }

  @Get('admin/profiles/:userId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin: Get single matrimony profile by User ID' })
  async getAdminProfileById(@Param('userId') userId: string) {
    const data = await this.matrimonyService.getAdminProfileById(userId);
    return { success: true, data };
  }

  @Patch('admin/profiles/:userId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin: Update matrimony profile details' })
  async updateAdminProfile(@Param('userId') userId: string, @Body() body: any) {
    const data = await this.matrimonyService.updateAdminProfile(userId, body);
    return { success: true, data };
  }
}

