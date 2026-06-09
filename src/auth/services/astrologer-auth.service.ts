// src/auth/services/astrologer-auth.service.ts (UPDATED - OPTIONAL FCM TOKEN)
import { Injectable, BadRequestException, UnauthorizedException, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Astrologer, AstrologerDocument } from '../../astrologers/schemas/astrologer.schema';
import { OtpService } from './otp/otp.service';
import { JwtAuthService } from './jwt-auth/jwt-auth.service';
import { SimpleCacheService } from './cache/cache.service';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { TruecallerService } from './truecaller.service';
import { TruecallerVerifyDto } from '../dto/truecaller-verify.dto';
import * as crypto from 'crypto';

@Injectable()
export class AstrologerAuthService {
  private readonly logger = new Logger(AstrologerAuthService.name);

  constructor(
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    private otpService: OtpService,
    private jwtAuthService: JwtAuthService,
    private cacheService: SimpleCacheService,
    private truecallerService: TruecallerService,
  ) {}

  private generatePhoneHash(phoneNumber: string): string {
    return crypto.createHash('sha256').update(phoneNumber).digest('hex').substring(0, 16);
  }

  /**
   * ✅ UPDATED: Handle device storage for astrologers - FCM token is now OPTIONAL
   */
  private async handleDeviceStorage(astrologer: AstrologerDocument, deviceInfo?: any): Promise<void> {
    // Early exit if no device info provided at all
    if (!deviceInfo) {
      this.logger.log('ℹ️ [AstrologerAuth] No device info provided, skipping device storage');
      return;
    }

    // Allow login without FCM token - only deviceId is required for tracking
    if (!deviceInfo.deviceId) {
      this.logger.warn('⚠️ [AstrologerAuth] Missing deviceId, skipping device storage');
      return;
    }

    this.logger.log('📱 [AstrologerAuth] Processing device storage...', {
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      deviceType: deviceInfo.deviceType || 'unknown',
      hasFcmToken: !!deviceInfo.fcmToken,
    });

    try {
      if (!astrologer.devices) {
        astrologer.devices = [];
      }

      // Search for existing device by deviceId AND deviceName
      const existingDeviceIndex = astrologer.devices.findIndex(
        (d: any) => 
          d.deviceId === deviceInfo.deviceId || 
          (deviceInfo.deviceName && d.deviceName === deviceInfo.deviceName && d.deviceType === deviceInfo.deviceType)
      );

      if (existingDeviceIndex !== -1) {
        // Device exists - update metadata (FCM token is optional)
        const oldFcmToken = astrologer.devices[existingDeviceIndex].fcmToken;
        
        astrologer.devices[existingDeviceIndex] = {
          ...astrologer.devices[existingDeviceIndex],
          fcmToken: deviceInfo.fcmToken || astrologer.devices[existingDeviceIndex].fcmToken, // Keep old if new not provided
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName || astrologer.devices[existingDeviceIndex].deviceName,
          deviceType: (deviceInfo.deviceType || astrologer.devices[existingDeviceIndex].deviceType) as 'android' | 'ios' | 'web',
          lastActive: new Date(),
          isActive: true,
        };

        this.logger.log('✅ [AstrologerAuth] Device updated', {
          deviceId: deviceInfo.deviceId,
          fcmTokenUpdated: !!deviceInfo.fcmToken,
          oldFcmToken: oldFcmToken ? oldFcmToken.substring(0, 20) + '...' : 'none',
          newFcmToken: deviceInfo.fcmToken ? deviceInfo.fcmToken.substring(0, 20) + '...' : 'none',
        });
      } else {
        // New device - add to array (FCM token optional)
        astrologer.devices.push({
          fcmToken: deviceInfo.fcmToken || undefined, // Store undefined if not provided
          deviceId: deviceInfo.deviceId,
          deviceType: (deviceInfo.deviceType || 'phone') as 'android' | 'ios' | 'web',
          deviceName: deviceInfo.deviceName || 'Unknown Device',
          lastActive: new Date(),
          isActive: true,
        });

        this.logger.log('✅ [AstrologerAuth] New device added', {
          deviceId: deviceInfo.deviceId,
          totalDevices: astrologer.devices.length,
          hasFcmToken: !!deviceInfo.fcmToken,
        });
      }

      astrologer.markModified('devices');

      // Single device mode - force logout other devices ONLY if they have FCM tokens
      if (astrologer.devices.length > 1) {
        // Send force logout notification to old devices that have FCM tokens
        const oldDevicesWithFcm = astrologer.devices
          .filter(d => d.deviceId !== deviceInfo.deviceId && d.fcmToken)
          .map(d => d.fcmToken);
        
        if (oldDevicesWithFcm.length > 0) {
          this.logger.log('📤 [AstrologerAuth] Sending force logout to old devices:', oldDevicesWithFcm.length);
          this.sendForceLogoutNotification(oldDevicesWithFcm).catch(err => 
            this.logger.error('Failed to send force logout:', err)
          );
        }

        // Keep only current device
        astrologer.devices = astrologer.devices.filter(d => d.deviceId === deviceInfo.deviceId);
        astrologer.markModified('devices');
        
        this.logger.log('✅ [AstrologerAuth] Kept only current device (single device mode)');
      }

      this.logger.log('✅ [AstrologerAuth] Device prepared for saving', {
        astrologerId: (astrologer._id as any).toString(),
        totalDevices: astrologer.devices.length,
      });
    } catch (deviceError) {
      this.logger.error('❌ [AstrologerAuth] Device storage failed:', {
        error: (deviceError as any).message,
        stack: (deviceError as any).stack,
      });
      // Don't fail login if device storage fails
    }
  }

  /**
   * ✅ Get complete astrologer profile
   */
  async getCurrentAstrologerProfile(astrologerId: string) {
    try {
      const astrologer = await this.astrologerModel
        .findById(astrologerId)
        .lean()
        .exec();

      if (!astrologer) {
        throw new NotFoundException('Astrologer profile not found');
      }

      const { __v, ...safeAstrologer } = astrologer as any;

      return { astrologer: safeAstrologer };
    } catch (error) {
      this.logger.error('Failed to fetch profile', { error: (error as any).message });
      throw error;
    }
  }

  /**
   * 🔍 Helper: Robustly find astrologer by phone number
   * Handles leading zeros and variant country code storage
   */
  private async findAstrologerByPhone(phoneNumber: string, countryCode: string, additionalQuery: any = {}) {
    // 1. Sanitize: Strip leading zeros and non-digits
    const cleanNumber = phoneNumber.replace(/^0+/, '').replace(/\D/g, '');
    const fullPhoneNumber = `+${countryCode}${cleanNumber}`;

    this.logger.log('🔍 [AstrologerAuth] Looking up astrologer...', { fullPhoneNumber });

    // 2. Try exact match first
    let astrologer = await this.astrologerModel.findOne({
      phoneNumber: fullPhoneNumber,
      ...additionalQuery
    });

    // 3. Fallback: Try regex match for trailing digits (last 10)
    if (!astrologer && cleanNumber.length >= 10) {
      const tail = cleanNumber.slice(-10);
      this.logger.log(`⚠️  [AstrologerAuth] Exact match failed. Trying fallback for tail: ${tail}`);
      astrologer = await this.astrologerModel.findOne({
        phoneNumber: { $regex: `${tail}$` },
        ...additionalQuery
      });
    }

    return astrologer;
  }

  /**
   * ✅ Check if phone number has approved astrologer account
   */
  async checkPhoneForLogin(phoneNumber: string, countryCode: string) {
    const astrologer = await this.findAstrologerByPhone(phoneNumber, countryCode, {
      accountStatus: { $in: ['active', 'inactive', 'deleted', 'suspended', ''] }
    });

    if (!astrologer) {
      this.logger.log('❌ No astrologer found');
      return {
        success: true,
        data: {
          canLogin: false,
          message: 'No approved astrologer account found with this number.'
        }
      };
    }

    // 1. Check Suspension
    if (astrologer.accountStatus === 'suspended') {
      this.logger.log('⚠️ Astrologer account suspended');
      return {
        success: true,
        data: {
          canLogin: false,
          message: 'Your account is suspended. Please contact support.'
        }
      };
    }

    // 2. ✅ Check Permanent Deletion Date (New Check)
    // If they are 'deleted' but the 7 days have passed, we must treat them as "Not Found" or "Permanently Deleted"
    if (astrologer.accountStatus === 'deleted') {
      const now = new Date();
      if (astrologer.permanentDeletionAt && now > astrologer.permanentDeletionAt) {
        return {
          success: true,
          data: {
            canLogin: false,
            message: 'This account has been permanently deleted and cannot be restored.'
          }
        };
      }
      // If within 7 days, allow them to proceed. 
      // restoration happens in verifyLoginOtp
    }

    this.logger.log('✅ Approved astrologer found', {
      astrologerId: astrologer._id
    });

    return {
      success: true,
      data: {
        canLogin: true,
        message: 'Account found. You can proceed to login.',
        astrologerName: astrologer.name,
        profileComplete: astrologer.profileCompletion.isComplete
      }
    };
  }

  /**
   * Send OTP for astrologer login
   */
  async sendLoginOtp(sendOtpDto: SendOtpDto) {
    const { phoneNumber, countryCode } = sendOtpDto;

    const checkResult = await this.checkPhoneForLogin(phoneNumber, countryCode);

    if (!checkResult.data.canLogin) {
      throw new BadRequestException(checkResult.data.message);
    }

    const result = await this.otpService.sendOTP(phoneNumber, countryCode);

    return {
      success: true,
      message: 'OTP sent successfully',
      data: {
        phoneNumber,
        countryCode: `+${countryCode}`,
        expiryTime: 600,
        ...(process.env.NODE_ENV === 'development' && result.otp && { otp: result.otp })
      }
    };
  }

  /**
   * ✅ UPDATED: Verify OTP and login astrologer - FCM token is OPTIONAL
   */
  async verifyLoginOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, countryCode, otp, fcmToken, deviceId, deviceType, deviceName } = verifyOtpDto;

    this.logger.log('🔍 [AstrologerAuth] Verifying OTP with device info:', {
      phoneNumber,
      otp: '****',
      fcmToken: fcmToken ? `${fcmToken.substring(0, 15)}...` : 'N/A',
      deviceId: deviceId || 'N/A',
      deviceType: deviceType || 'N/A',
      deviceName: deviceName || 'N/A',
      hasDeviceInfo: !!(deviceId || fcmToken),
    });

    const isOtpValid = await this.otpService.verifyOTP(phoneNumber, countryCode, otp);

    if (!isOtpValid) {
      this.logger.error('❌ Invalid OTP');
      throw new BadRequestException('Invalid or expired OTP');
    }

    this.logger.log('✅ OTP is valid');

    const astrologer = await this.findAstrologerByPhone(phoneNumber, countryCode);

    if (!astrologer) {
      throw new UnauthorizedException('Astrologer profile not found');
    }

    // ✅ CHECK DELETION STATUS FIRST
    if (astrologer.accountStatus === 'deleted') {
      const now = new Date();
      if (astrologer.permanentDeletionAt && now > astrologer.permanentDeletionAt) {
        throw new ForbiddenException('Your account has been permanently deleted.');
      }

      // Restore
      this.logger.log(`♻️ Restoring astrologer ${astrologer._id} from deletion`);
      astrologer.accountStatus = 'active';
      astrologer.permanentDeletionAt = undefined;
      astrologer.deletionReason = undefined;
      
      // Optional: You might want to keep them 'offline' until they manually go online
      astrologer.availability.isAvailable = false; 
    }
    else if (astrologer.accountStatus === 'suspended') {
      throw new UnauthorizedException(
        `Your account is suspended. Reason: ${astrologer.suspensionReason || 'Please contact support'}`
      );
    }
    else if (astrologer.accountStatus === 'inactive' || astrologer.accountStatus === '') {
      astrologer.accountStatus = 'active';
    }

    // Handle device storage - now fully optional
    if (deviceId || fcmToken) {
      await this.handleDeviceStorage(astrologer, {
        fcmToken,
        deviceId,
        deviceType,
        deviceName
      });
    } else {
      this.logger.log('ℹ️ [AstrologerAuth] No device info provided, skipping device management');
    }

    astrologer.availability.lastActive = new Date();
    
    await astrologer.save();
    this.logger.log('✅ Astrologer document saved');

    // Generate astrologer-specific tokens
    const tokens = this.jwtAuthService.generateAstrologerTokens(
      astrologer._id as Types.ObjectId,
      astrologer.phoneNumber,
      'astrologer'
    );

    await this.cacheService.set(
      `astrologer_refresh_${(astrologer._id as any).toString()}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60
    );

    this.logger.log('✅ Astrologer login successful');

    return {
      success: true,
      message: astrologer.permanentDeletionAt === undefined 
        ? 'Welcome back! Your account deletion request has been cancelled.' 
        : 'Login successful',
      data: {
        astrologer,
        tokens,
      },
    };
  }

  /**
   * Refresh astrologer token
   */
  async refreshToken(refreshToken: string) {
    try {
      this.logger.log('🔄 Refreshing astrologer token');

      const newTokens = this.jwtAuthService.refreshAstrologerToken(refreshToken);
      
      const payload = this.jwtAuthService.verifyRefreshToken(refreshToken);
      
      await this.cacheService.set(
        `astrologer_refresh_${payload.userId}`,
        newTokens.refreshToken,
        7 * 24 * 60 * 60
      );

      this.logger.log('✅ Token refreshed successfully');

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: newTokens
      };
    } catch (error) {
      this.logger.error('❌ Token refresh failed', { error: error.message });
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout astrologer and remove device token
   */
  async logout(userId: string, astrologerId: string, deviceId?: string) {
    try {
      this.logger.log('🚪 Logging out astrologer', { userId, astrologerId, deviceId });

      await this.cacheService.del(`astrologer_refresh_${astrologerId}`);

      const astrologer = await this.astrologerModel.findById(astrologerId);
      
      if (astrologer && astrologer.devices && astrologer.devices.length > 0) {
        if (deviceId) {
          const initialCount = astrologer.devices.length;
          astrologer.devices = astrologer.devices.filter(
            (device) => device.deviceId !== deviceId
          );
          
          if (astrologer.devices.length < initialCount) {
            astrologer.markModified('devices');
            this.logger.log(`📱 Removed device ${deviceId} from astrologer`);
          }
        } else {
          this.logger.log('📱 Marking all devices as inactive');
          
          astrologer.devices = astrologer.devices.map(device => ({
            ...device,
            isActive: false,
            lastActive: device.lastActive
          }));
          
          astrologer.markModified('devices');
        }
        
        await astrologer.save();
        this.logger.log('✅ Device changes saved');
      }

      await this.astrologerModel.findByIdAndUpdate(
        astrologerId,
        {
          'availability.isOnline': false,
          'availability.isAvailable': false,
          'availability.isLive': false,
          'availability.lastActive': new Date()
        }
      );

      this.logger.log('✅ Logout successful');

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      this.logger.error('❌ Logout failed', { error: error.message });
      throw new BadRequestException('Logout failed');
    }
  }

  /**
   * Send force logout notification via FCM
   */
  private async sendForceLogoutNotification(fcmTokens: string[]): Promise<void> {
    try {
      this.logger.log('📤 [AstrologerAuth] Force logout notification sent to:', {
        count: fcmTokens.length,
        tokens: fcmTokens.map(t => t.substring(0, 20) + '...'),
      });

      // TODO: Replace with your actual FCM service
      /*
      const payload = {
        tokens: fcmTokens,
        notification: {
          title: 'Logged Out',
          body: 'You have been logged out because you signed in from another device.',
        },
        data: {
          type: 'force_logout',
          reason: 'new_device_login',
          userType: 'astrologer',
          timestamp: new Date().toISOString(),
        },
      };

      await this.fcmService.sendMulticast(payload);
      */
    } catch (error) {
      this.logger.error('❌ [AstrologerAuth] Failed to send force logout notification:', error);
    }
  }

  /**
   * ✅ UPDATED: Verify Truecaller for astrologer - FCM token is OPTIONAL
   */
  async verifyTruecaller(truecallerVerifyDto: TruecallerVerifyDto, deviceInfo?: any) {
    try {
      this.logger.log('🔍 [AstrologerAuth] Starting Truecaller verification', {
        hasDeviceInfo: !!deviceInfo,
        hasFcmToken: !!deviceInfo?.fcmToken,
        hasDeviceId: !!deviceInfo?.deviceId,
      });

      const verification = await this.truecallerService.verifyOAuthCode(
        truecallerVerifyDto.authorizationCode,
        truecallerVerifyDto.codeVerifier,
        'astro'
      );

      if (!verification.success || !verification.userProfile) {
        throw new BadRequestException(verification.message || 'Truecaller verification failed');
      }

      const { phoneNumber, countryCode, firstName, lastName } = verification.userProfile;
      const phoneHash = this.generatePhoneHash(phoneNumber);
      const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Astrologer';

      this.logger.log('✅ [AstrologerAuth] Truecaller provided phone', { phoneNumber, countryCode });

      let astrologer = await this.astrologerModel.findOne({
        phoneNumber: phoneNumber
      });

      if (!astrologer) {
        this.logger.log('⚠️ [AstrologerAuth] No astrologer profile found for phone', { phoneNumber });
        return {
          success: true,
          data: {
            canLogin: false,
            message: 'No astrologer profile found. Please complete astrologer registration first.',
            phoneNumber: phoneNumber,
            countryCode: countryCode,
            name: fullName,
            isNewUser: true
          }
        };
      }

      if (astrologer.accountStatus === 'suspended') {
        this.logger.log('⚠️ [AstrologerAuth] Astrologer suspended', { astrologerId: astrologer._id });
        throw new UnauthorizedException(
          `Your account is suspended. Reason: ${astrologer.suspensionReason || 'Please contact support'}`
        );
      }

      // Reactivate if needed
if (astrologer.accountStatus === 'deleted') {
  const now = new Date();
  // 1. Check if the permanent deletion time has passed
  if (astrologer.permanentDeletionAt && now > astrologer.permanentDeletionAt) {
    throw new ForbiddenException('Your account has been permanently deleted.');
  }
  // 2. Restore if within grace period
  astrologer.accountStatus = 'active';
  astrologer.permanentDeletionAt = undefined;
  astrologer.deletionReason = undefined;
} 
else if (astrologer.accountStatus === 'inactive') {
  astrologer.accountStatus = 'active';
}

      // Register device if provided - now fully optional
      if (deviceInfo && (deviceInfo.deviceId || deviceInfo.fcmToken)) {
        await this.handleDeviceStorage(astrologer, deviceInfo);
      } else {
        this.logger.log('ℹ️ [AstrologerAuth] No device info provided, skipping device management');
      }

      astrologer.availability.lastActive = new Date();
      await astrologer.save();

      // Generate astrologer-specific tokens
      const tokens = this.jwtAuthService.generateAstrologerTokens(
        astrologer._id as Types.ObjectId,
        astrologer.phoneNumber,
        'astrologer'
      );

      await this.cacheService.set(
        `astrologer_refresh_${(astrologer._id as any).toString()}`,
        tokens.refreshToken,
        7 * 24 * 60 * 60
      );

      this.logger.log('✅ [AstrologerAuth] Truecaller authentication successful for astrologer', {
        astrologerId: astrologer._id
      });

      return {
        success: true,
        message: 'Login successful',
        data: {
          astrologer,
          tokens,
        }
      };
    } catch (error) {
      this.logger.error('❌ [AstrologerAuth] Truecaller verification failed', {
        message: (error as any).message,
      });
      throw new BadRequestException((error as any).message || 'Truecaller login failed for astrologer');
    }
  }
}
