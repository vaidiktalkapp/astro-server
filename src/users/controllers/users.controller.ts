import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';

interface AuthenticatedRequest extends Request {
  user: { _id: string };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) { }

  // ===== PROFILE =====

  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserProfile(req.user._id);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(req.user._id, updateProfileDto);
  }

  // ===== SAVED PROFILES (MULTIPLE PROFILES) =====
  @Post('profiles')
  async addSavedProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: any
  ) {
    return this.usersService.addSavedProfile(req.user._id, body);
  }

  @Put('profiles/:profileId')
  async updateSavedProfile(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Body() body: any
  ) {
    return this.usersService.updateSavedProfile(req.user._id, profileId, body);
  }

  @Delete('profiles/:profileId')
  async deleteSavedProfile(
    @Req() req: AuthenticatedRequest,
    @Param('profileId') profileId: string
  ) {
    return this.usersService.deleteSavedProfile(req.user._id, profileId);
  }

  @Post('profile/phone/send-otp')
  async sendPhoneChangeOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phoneNumber: string; countryCode: string }
  ) {
    return this.usersService.sendPhoneChangeOtp(req.user._id, body.phoneNumber, body.countryCode);
  }

  @Post('profile/phone/verify-otp')
  async verifyPhoneChangeOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phoneNumber: string; countryCode: string; otp: string }
  ) {
    return this.usersService.verifyPhoneChangeOtp(req.user._id, body.phoneNumber, body.countryCode, body.otp);
  }

  // ===== PREFERENCES =====

  @Get('preferences')
  async getPreferences(@Req() req: AuthenticatedRequest) {
    return this.usersService.getPreferences(req.user._id);
  }

  @Patch('preferences')
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateDto: UpdatePreferencesDto
  ) {
    return this.usersService.updatePreferences(req.user._id, updateDto);
  }

  // ===== WALLET =====

  @Get('wallet')
  async getWallet(@Req() req: AuthenticatedRequest) {
    return this.usersService.getWallet(req.user._id);
  }

  // ===== FAVORITES =====

  @Get('favorites')
  async getFavorites(@Req() req: AuthenticatedRequest) {
    return this.usersService.getFavoriteAstrologers(req.user._id);
  }

  @Post('favorites/:astrologerId')
  async addFavorite(
    @Param('astrologerId') astrologerId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.usersService.addFavorite(req.user._id, astrologerId);
  }

  @Delete('favorites/:astrologerId')
  async removeFavorite(
    @Param('astrologerId') astrologerId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.usersService.removeFavorite(req.user._id, astrologerId);
  }

  // ===== STATISTICS =====

  @Get('statistics')
  async getStatistics(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserStatistics(req.user._id);
  }

  // ===== ACCOUNT =====

  @Delete('account')
  async deleteAccount(@Req() req: AuthenticatedRequest) {
    return this.usersService.deleteAccount(req.user._id);
  }
}
