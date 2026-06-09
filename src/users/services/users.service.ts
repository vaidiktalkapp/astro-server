import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { OtpService } from '../../auth/services/otp/otp.service';
import { JwtAuthService } from '../../auth/services/jwt-auth/jwt-auth.service';
import { SimpleCacheService } from '../../auth/services/cache/cache.service';
import { SystemSettings, SystemSettingsDocument } from '../../payments/schemas/system-settings.schema';
import { WalletTransaction, WalletTransactionDocument } from '../../payments/schemas/wallet-transaction.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SystemSettings.name) private systemSettingsModel: Model<SystemSettingsDocument>,
    @InjectModel(WalletTransaction.name) private walletTransactionModel: Model<WalletTransactionDocument>,
    private otpService: OtpService,
    private jwtAuthService: JwtAuthService,
    private cacheService: SimpleCacheService,
  ) { }

  // ===== PROFILE MANAGEMENT =====

  // Get user profile
  async getUserProfile(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('-phoneHash -deviceTokens')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        isPhoneVerified: user.isPhoneVerified,
        registrationMethod: user.registrationMethod,
        name: user.name,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        timeOfBirth: user.timeOfBirth,
        placeOfBirth: user.placeOfBirth,
        currentAddress: user.currentAddress,
        city: user.city,
        state: user.state,
        country: user.country,
        pincode: user.pincode,
        profileImage: user.profileImage,
        profileImageStorageType: user.profileImageStorageType,
        isProfileComplete: user.isProfileComplete,
        appLanguage: user.appLanguage,
        savedProfiles: user.savedProfiles || [],
        notifications: user.notifications,
        privacy: user.privacy,
        wallet: user.wallet,
        stats: user.stats,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
      },
    };
  }

  // Update user profile
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build update object
    const updateFields: any = {};

    if (updateProfileDto.name !== undefined) updateFields.name = updateProfileDto.name;
    if (updateProfileDto.gender !== undefined) updateFields.gender = updateProfileDto.gender;
    if (updateProfileDto.dateOfBirth !== undefined) updateFields.dateOfBirth = updateProfileDto.dateOfBirth;
    if (updateProfileDto.timeOfBirth !== undefined) updateFields.timeOfBirth = updateProfileDto.timeOfBirth;
    if (updateProfileDto.placeOfBirth !== undefined) updateFields.placeOfBirth = updateProfileDto.placeOfBirth;
    if (updateProfileDto.currentAddress !== undefined) updateFields.currentAddress = updateProfileDto.currentAddress;
    if (updateProfileDto.city !== undefined) updateFields.city = updateProfileDto.city;
    if (updateProfileDto.state !== undefined) updateFields.state = updateProfileDto.state;
    if (updateProfileDto.country !== undefined) updateFields.country = updateProfileDto.country;
    if (updateProfileDto.pincode !== undefined) updateFields.pincode = updateProfileDto.pincode;
    if (updateProfileDto.profileImage !== undefined) {
      updateFields.profileImage = updateProfileDto.profileImage;
      updateFields.profileImageStorageType = updateProfileDto.profileImageStorageType || 's3';
      if (updateProfileDto.profileImageS3Key) {
        updateFields.profileImageS3Key = updateProfileDto.profileImageS3Key;
      }
    }

    // Check if profile is complete
    const isProfileComplete = !!(
      updateFields.name || user.name
    ) && !!(
      updateFields.gender || user.gender
    ) && !!(
      updateFields.dateOfBirth || user.dateOfBirth
    );

    updateFields.isProfileComplete = isProfileComplete;
    updateFields.updatedAt = new Date();

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select('-phoneHash -deviceTokens');

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    };
  }

  // Add a saved profile
  async addSavedProfile(userId: string, profileData: any): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.savedProfiles && user.savedProfiles.length >= 5) {
      throw new BadRequestException('Maximum limit of 5 saved profiles reached');
    }

    const newProfile = {
      _id: new Types.ObjectId(),
      ...profileData,
      createdAt: new Date()
    };

    user.savedProfiles.push(newProfile);
    await user.save();

    return {
      success: true,
      message: 'Profile saved successfully',
      data: newProfile
    };
  }

  // Update a saved profile
  async updateSavedProfile(userId: string, profileId: string, profileData: any): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileIndex = user.savedProfiles.findIndex(p => p._id.toString() === profileId);
    if (profileIndex === -1) {
      throw new NotFoundException('Saved profile not found');
    }

    const updatedProfile = {
      ...user.savedProfiles[profileIndex],
      ...profileData
    };

    user.savedProfiles[profileIndex] = updatedProfile;
    // Mark modified for mixed arrays/subdocuments just in case
    user.markModified('savedProfiles');
    await user.save();

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    };
  }

  // Delete a saved profile
  async deleteSavedProfile(userId: string, profileId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const initialLength = user.savedProfiles.length;
    user.savedProfiles = user.savedProfiles.filter(p => p._id.toString() !== profileId);

    if (user.savedProfiles.length === initialLength) {
      throw new NotFoundException('Saved profile not found');
    }

    await user.save();

    return {
      success: true,
      message: 'Profile deleted successfully'
    };
  }

  async sendPhoneChangeOtp(userId: string, phoneNumber: string, countryCode: string): Promise<any> {
    const cleanPhone = this.otpService.normalizePhoneNumber(phoneNumber, countryCode);
    const fullPhoneNumber = `+${countryCode}${cleanPhone}`;
    const phoneHash = this.otpService.hashPhoneNumber(cleanPhone, countryCode);

    // 1. Check if another user already has this phone number
    const existingUser = await this.userModel.findOne({
      $or: [
        { phoneNumber: fullPhoneNumber },
        { phoneNumber: cleanPhone },
        { phoneHash: phoneHash }
      ],
      _id: { $ne: userId }
    });

    if (existingUser) {
      throw new BadRequestException('This phone number is already associated with another account');
    }

    // 2. Send OTP
    return this.otpService.sendOTP(cleanPhone, countryCode);
  }

  async verifyPhoneChangeOtp(userId: string, phoneNumber: string, countryCode: string, otp: string): Promise<any> {
    // 1. Verify OTP
    const isOtpValid = await this.otpService.verifyOTP(phoneNumber, countryCode, otp);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Ensure we use the clean phone number for storage and hashing
    const cleanPhone = this.otpService.normalizePhoneNumber(phoneNumber, countryCode);
    const fullPhoneNumber = `+${countryCode}${cleanPhone}`;
    const phoneHash = this.otpService.hashPhoneNumber(cleanPhone, countryCode);

    // 2. Update user's phone number
    const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        phoneNumber: fullPhoneNumber,
        phoneHash: phoneHash,
        countryCode: countryCode,
        updatedAt: new Date()
      }
    }, { new: true });

    if (!updatedUser) {
      throw new BadRequestException('User not found');
    }

    const tokens = this.jwtAuthService.generateTokenPair(
      updatedUser._id as Types.ObjectId,
      updatedUser.phoneNumber,
      updatedUser.phoneHash
    );

    await this.cacheService.set(
      `refresh_token_${(updatedUser._id).toString()}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60
    );

    return {
      success: true,
      message: 'Phone number updated successfully',
      data: {
        tokens
      }
    };
  }

  // ===== PREFERENCES MANAGEMENT =====

  // Get user preferences
  async getPreferences(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('appLanguage notifications privacy')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        appLanguage: user.appLanguage,
        notifications: user.notifications,
        privacy: user.privacy,
      },
    };
  }

  // Update user preferences
  async updatePreferences(userId: string, updateDto: UpdatePreferencesDto): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateFields: any = {};

    if (updateDto.appLanguage !== undefined) {
      updateFields.appLanguage = updateDto.appLanguage;
    }

    if (updateDto.liveEventsNotification !== undefined) {
      updateFields['notifications.liveEvents'] = updateDto.liveEventsNotification;
    }

    if (updateDto.normalNotification !== undefined) {
      updateFields['notifications.normal'] = updateDto.normalNotification;
    }

    if (updateDto.nameVisibleInReviews !== undefined) {
      updateFields['privacy.nameVisibleInReviews'] = updateDto.nameVisibleInReviews;
    }

    if (updateDto.astrologerChatAccessAfterEnd !== undefined) {
      updateFields['privacy.restrictions.astrologerChatAccessAfterEnd'] = updateDto.astrologerChatAccessAfterEnd;
    }

    if (updateDto.downloadSharedImages !== undefined) {
      updateFields['privacy.restrictions.downloadSharedImages'] = updateDto.downloadSharedImages;
    }

    if (updateDto.restrictChatScreenshots !== undefined) {
      updateFields['privacy.restrictions.restrictChatScreenshots'] = updateDto.restrictChatScreenshots;
    }

    if (updateDto.accessCallRecording !== undefined) {
      updateFields['privacy.restrictions.accessCallRecording'] = updateDto.accessCallRecording;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { ...updateFields, updatedAt: new Date() } },
      { new: true }
    ).select('appLanguage notifications privacy');

    // ✅ FIX: Add null check BEFORE accessing properties
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }

    // ✅ NOW it's safe to access properties
    return {
      success: true,
      message: 'Preferences updated successfully',
      data: {
        appLanguage: updatedUser.appLanguage,
        notifications: updatedUser.notifications,
        privacy: updatedUser.privacy,
      },
    };
  }


  // ===== WALLET MANAGEMENT =====

  // Get wallet details
  async getWallet(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('wallet')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallet = user.wallet as any;
    const currentBalance = wallet?.balance || 0;

    return {
      success: true,
      data: {
        ...wallet,
        balance: currentBalance,
        cashBalance: wallet?.cashBalance ?? currentBalance,
        bonusBalance: wallet?.bonusBalance ?? 0,
      },
    };
  }

  // ===== FAVORITES MANAGEMENT =====

  // Get favorite astrologers
  async getFavoriteAstrologers(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('favoriteAstrologers')
      .populate('favoriteAstrologers', 'name profilePicture experienceYears specializations ratings pricing')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: user.favoriteAstrologers,
    };
  }

  // Add to favorites
  async addFavorite(userId: string, astrologerId: string): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already in favorites
    if (user.favoriteAstrologers.some(id => id.toString() === astrologerId)) {
      throw new BadRequestException('Astrologer already in favorites');
    }

    user.favoriteAstrologers.push(astrologerId as any);
    await user.save();

    return {
      success: true,
      message: 'Astrologer added to favorites',
    };
  }

  // Remove from favorites
  async removeFavorite(userId: string, astrologerId: string): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.favoriteAstrologers = user.favoriteAstrologers.filter(
      id => id.toString() !== astrologerId
    );

    await user.save();

    return {
      success: true,
      message: 'Astrologer removed from favorites',
    };
  }

  // ===== STATISTICS =====

  // Get user statistics
  async getUserStatistics(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('wallet stats')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        wallet: user.wallet,
        stats: user.stats,
      },
    };
  }

  // Update user stats (internal use only)
  async updateStats(
    userId: string,
    updates: {
      incrementSessions?: number;
      addMinutes?: number;
      addAmount?: number;
      incrementRatings?: number;
    }
  ): Promise<void> {
    const updateFields: any = {};

    if (updates.incrementSessions) {
      updateFields.$inc = { ...updateFields.$inc, 'stats.totalSessions': updates.incrementSessions };
    }
    if (updates.addMinutes) {
      updateFields.$inc = { ...updateFields.$inc, 'stats.totalMinutesSpent': updates.addMinutes };
    }
    if (updates.addAmount) {
      updateFields.$inc = { ...updateFields.$inc, 'stats.totalAmount': updates.addAmount };
    }
    if (updates.incrementRatings) {
      updateFields.$inc = { ...updateFields.$inc, 'stats.totalRatings': updates.incrementRatings };
    }

    if (Object.keys(updateFields).length > 0) {
      await this.userModel.findByIdAndUpdate(userId, updateFields);
    }
  }

  // ===== ACCOUNT MANAGEMENT =====

  // Delete user account (soft delete)
  async deleteAccount(userId: string, reason?: string): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate date 48 hours (2 days) from now
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 2);

    await this.userModel.findByIdAndUpdate(userId, {
      status: 'deleted',
      permanentDeletionAt: deletionDate,
      deletionReason: reason,
      updatedAt: new Date(),
      // Clear sensitive device data immediately to prevent push notifications
      devices: [],
    });

    return {
      success: true,
      message: 'Account scheduled for deletion. It will be permanently removed in 48 hours.',
      data: {
        scheduledDate: deletionDate,
        restoreAvailableUntil: deletionDate
      }
    };
  }

  // ✅ NEW: CRON Job to handle permanent deletion
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledDeletions() {
    this.logger.log('Starting scheduled user account deletion cleanup...');

    const now = new Date();

    // Find users marked for deletion whose time has passed
    const usersToDelete = await this.userModel.find({
      status: 'deleted',
      permanentDeletionAt: { $lte: now }
    }).select('_id phoneNumber');

    if (usersToDelete.length === 0) return;

    let deletedCount = 0;

    for (const user of usersToDelete) {
      try {
        // ✅ CHANGED: Use anonymizeUser instead of deleteOne
        await this.anonymizeUser(user._id as unknown as string);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to anonymize user ${user._id}: ${error.message}`);
      }
    }

    this.logger.log(`Cleanup complete. Anonymized ${deletedCount} user accounts.`);
  }

  // Update last active timestamp
  async updateLastActive(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      lastActiveAt: new Date(),
    });
  }

  // ===== INTERNAL METHODS =====

  // Get user by phone number
  async getUserByPhone(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  // Create new user
  async createUser(userData: {
    phoneNumber: string;
    countryCode: string;
    phoneHash: string;
    registrationMethod: 'truecaller' | 'otp';
  }): Promise<UserDocument> {
    const user = new this.userModel({
      ...userData,
      isPhoneVerified: true,
      appLanguage: 'en',
      notifications: {
        liveEvents: true,
        normal: true,
      },
      privacy: {
        nameVisibleInReviews: false,
        restrictions: {
          astrologerChatAccessAfterEnd: true,
          downloadSharedImages: true,
          restrictChatScreenshots: true,
          accessCallRecording: true,
        },
      },
      wallet: {
        balance: 0,
        currency: 'INR',
        cashBalance: 0,
        bonusBalance: 0,
        totalBonusReceived: 0,
        totalBonusSpent: 0,
        totalRecharged: 0,
        totalSpent: 0,
      },
      stats: {
        totalSessions: 0,
        totalMinutesSpent: 0,
        totalAmount: 0,
        totalRatings: 0,
      },
      favoriteAstrologers: [],
      status: 'active',
    });

    const savedUser = await user.save();

    return savedUser;
  }

  async anonymizeUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    this.logger.log(`Anonymizing user data for: ${userId}`);

    // 1. Generate random anonymous ID
    // Format: +91000... to ensure it passes the regex validator ^(\+\d{10,15}|\d{10,15})$
    const randomSuffix = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10 digits
    const dummyPhone = `+00${randomSuffix}`;

    // 2. Overwrite PII fields
    user.name = "Deleted User";
    user.phoneNumber = dummyPhone;
    user.phoneHash = `deleted_${user._id}`; // Ensure uniqueness for index

    // 3. Clear location/profile data
    user.currentAddress = undefined;
    user.city = undefined;
    user.state = undefined;
    user.placeOfBirth = undefined;
    user.dateOfBirth = undefined;
    user.timeOfBirth = undefined;

    // ✅ FIX 1: Don't set to null if schema has a default string. 
    // Set to empty string to clear the image while maintaining type safety.
    user.profileImage = '';
    user.profileImageS3Key = '';

    // 4. Clear technical data
    user.devices = []; // Remove FCM tokens
    user.favoriteAstrologers = [];
    user.blockedAstrologers = [];


    // 6. Set Status & Clear Timer
    user.status = 'deleted';
    // ✅ CRITICAL: Unset this date so the Cron Job doesn't pick it up again tomorrow
    user.permanentDeletionAt = undefined;
    user.deletionReason = undefined;

    await user.save();
  }
}
