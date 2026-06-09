// src/astrologers/core/services/astrologer.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Astrologer, AstrologerDocument } from '../schemas/astrologer.schema';
import { Registration, RegistrationDocument } from '../../registration/schemas/registration.schema'; // ✅ ADD

@Injectable()
export class AstrologerService {
  private readonly logger = new Logger(AstrologerService.name);

  constructor(
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(Registration.name) private registrationModel: Model<RegistrationDocument>, // ✅ ADD
  ) { }

  /**
   * Private Helper: Automatically heals and completes profile if all required steps are true but isComplete is false.
   */
  private async selfHealProfileCompletion(astrologerId: string): Promise<void> {
    try {
      const astrologer = await this.astrologerModel.findById(astrologerId);
      if (astrologer && !astrologer.profileCompletion.isComplete) {
        const steps = astrologer.profileCompletion.steps;
        const allStepsComplete =
          steps.basicInfo === true &&
          steps.expertise === true &&
          steps.pricing === true &&
          steps.availability === true;

        if (allStepsComplete) {
          astrologer.profileCompletion.isComplete = true;
          astrologer.profileCompletion.completedAt = new Date();
          astrologer.isChatEnabled = true;
          astrologer.isCallEnabled = true;
          astrologer.isLiveStreamEnabled = true;
          await astrologer.save();
          this.logger.log(`⚡ [Self-Healing] Automatically completed profile for astrologer ${astrologerId}`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ [Self-Healing] Failed to auto-complete profile for ${astrologerId}: ${error.message}`);
    }
  }

  /**
   * ✅ NEW: Get complete profile with ALL details
   */
  async getCompleteProfile(astrologerId: string): Promise<any> {
    await this.selfHealProfileCompletion(astrologerId);
    const astrologer = await this.astrologerModel
      .findById(astrologerId)
      .populate('registrationId', 'ticketNumber status')
      .select('-__v -devices.fcmToken')
      .lean();

    if (!astrologer) {
      throw new NotFoundException('Astrologer profile not found');
    }

    const steps = astrologer.profileCompletion.steps;
    const completedSteps = Object.values(steps).filter(step => step === true).length;
    const totalSteps = Object.keys(steps).length;
    const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

    return {
      success: true,
      data: {
        _id: astrologer._id,
        name: astrologer.name,
        email: astrologer.email,
        phoneNumber: astrologer.phoneNumber,
        dateOfBirth: astrologer.dateOfBirth,
        gender: astrologer.gender,
        profilePicture: astrologer.profilePicture,
        bio: astrologer.bio,
        experienceYears: astrologer.experienceYears,
        specializations: astrologer.specializations,
        languages: astrologer.languages,
        tier: astrologer.tier,
        pricing: astrologer.pricing,
        availability: {
          isOnline: astrologer.availability.isOnline,
          isAvailable: astrologer.availability.isAvailable,
          isLive: astrologer.availability.isLive,
          workingHours: astrologer.availability.workingHours,
          lastActive: astrologer.availability.lastActive,
        },
        isChatEnabled: astrologer.isChatEnabled,
        isCallEnabled: astrologer.isCallEnabled,
        isLiveStreamEnabled: astrologer.isLiveStreamEnabled,
        accountStatus: astrologer.accountStatus,
        singleDeviceMode: astrologer.singleDeviceMode,
        profileCompletion: {
          isComplete: astrologer.profileCompletion.isComplete,
          completedAt: astrologer.profileCompletion.completedAt,
          percentage: completionPercentage,
          completedSteps,
          totalSteps,
          steps: astrologer.profileCompletion.steps,
        },
        ratings: astrologer.ratings,
        stats: astrologer.stats,
        earnings: astrologer.earnings,
        registrationId: astrologer.registrationId,
        createdAt: astrologer.createdAt,
        updatedAt: astrologer.updatedAt,
      },
    };
  }

  /**
   * Get astrologer profile (basic - kept for backward compatibility)
   */
  async getProfile(astrologerId: string): Promise<any> {
    const astrologer = await this.astrologerModel
      .findById(astrologerId)
      .populate('registrationId', 'ticketNumber status')
      .select('-__v')
      .lean();

    if (!astrologer) {
      throw new NotFoundException('Astrologer profile not found');
    }

    return {
      success: true,
      data: astrologer
    };
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletionStatus(astrologerId: string): Promise<any> {
    await this.selfHealProfileCompletion(astrologerId);
    const astrologer = await this.astrologerModel
      .findById(astrologerId)
      .select('profileCompletion')
      .lean();

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    const steps = astrologer.profileCompletion.steps;
    const completedSteps = Object.values(steps).filter(step => step === true).length;
    const totalSteps = Object.keys(steps).length;
    const percentage = Math.round((completedSteps / totalSteps) * 100);

    return {
      success: true,
      data: {
        isComplete: astrologer.profileCompletion.isComplete,
        completedAt: astrologer.profileCompletion.completedAt,
        percentage,
        completedSteps,
        totalSteps,
        steps: {
          basicInfo: { completed: steps.basicInfo, label: 'Basic Information' },
          expertise: { completed: steps.expertise, label: 'Expertise & Languages' },
          pricing: { completed: steps.pricing, label: 'Pricing Setup' },
          availability: { completed: steps.availability, label: 'Availability & Working Hours' }
        }
      }
    };
  }

  /**
   * ✅ UPDATED: Update pricing & auto-complete profile
   */
  async updatePricing(astrologerId: string, pricing: any): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // Update pricing
    astrologer.pricing = {
      chat: pricing.chat,
      call: pricing.call,
      videoCall: pricing.videoCall || 0
    };
    astrologer.profileCompletion.steps.pricing = true;

    // ✅ NEW: Auto-complete availability step (working hours are optional)
    astrologer.profileCompletion.steps.availability = true;

    // ✅ NEW: Force complete profile after pricing update (ignore gallery as it's not required yet)
    const allStepsComplete =
      astrologer.profileCompletion.steps.basicInfo === true &&
      astrologer.profileCompletion.steps.expertise === true &&
      astrologer.profileCompletion.steps.pricing === true &&
      astrologer.profileCompletion.steps.availability === true;

    if (allStepsComplete) {
      astrologer.profileCompletion.isComplete = true;
      astrologer.profileCompletion.completedAt = new Date();

      // ✅ Enable all services
      astrologer.isChatEnabled = true;
      astrologer.isCallEnabled = true;
      astrologer.isLiveStreamEnabled = true;

      // ✅ Make astrologer available
      astrologer.availability.isOnline = true;
      astrologer.availability.isAvailable = true;
      astrologer.availability.lastActive = new Date();

      this.logger.log(`✅ Profile auto-completed for astrologer ${astrologerId}`);
    }

    await astrologer.save();

    return {
      success: true,
      message: allStepsComplete
        ? 'Pricing updated & profile completed! You are now available for orders.'
        : 'Pricing updated successfully',
      data: {
        pricing: astrologer.pricing,
        profileCompletion: astrologer.profileCompletion,
        availability: {
          isOnline: astrologer.availability.isOnline,
          isAvailable: astrologer.availability.isAvailable,
        },
        servicesEnabled: {
          chat: astrologer.isChatEnabled,
          call: astrologer.isCallEnabled,
          liveStream: astrologer.isLiveStreamEnabled,
        }
      }
    };
  }

  /**
   * Update availability/working hours
   */
  async updateAvailability(astrologerId: string, availabilityData: any): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    astrologer.availability.workingHours = availabilityData.workingHours;
    astrologer.profileCompletion.steps.availability = true; // Always mark as complete

    await this.checkAndUpdateProfileCompletion(astrologer);
    await astrologer.save();

    return {
      success: true,
      message: 'Availability updated successfully',
      data: {
        availability: astrologer.availability,
        profileCompletion: astrologer.profileCompletion
      }
    };
  }

  /**
   * Toggle online status
   */
  async toggleOnlineStatus(astrologerId: string, isOnline: boolean): Promise<any> {
    await this.selfHealProfileCompletion(astrologerId);
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // ✅ Check if profile is complete before going online
    if (isOnline && !astrologer.profileCompletion.isComplete) {
      throw new BadRequestException({
        message: 'Please complete your profile before going online',
        missingSteps: this.getMissingProfileSteps(astrologer.profileCompletion.steps)
      });
    }

    astrologer.availability.isOnline = isOnline;
    if (isOnline) {
      astrologer.availability.isAvailable = true;
      astrologer.availability.busyUntil = undefined;
    }
    astrologer.availability.lastActive = new Date();

    await astrologer.save();

    return {
      success: true,
      message: `You are now ${isOnline ? 'online' : 'offline'}`,
      data: {
        isOnline: astrologer.availability.isOnline,
        isAvailable: astrologer.availability.isAvailable,
        lastActive: astrologer.availability.lastActive
      }
    };
  }

  /**
   * Toggle availability (for receiving orders)
   */
  async toggleAvailability(astrologerId: string, isAvailable: boolean): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // Can only be available if online
    if (isAvailable && !astrologer.availability.isOnline) {
      throw new BadRequestException('You must be online to mark yourself as available');
    }

    astrologer.availability.isAvailable = isAvailable;
    astrologer.availability.lastActive = new Date();

    await astrologer.save();

    return {
      success: true,
      message: `You are now ${isAvailable ? 'available' : 'unavailable'} for orders`,
      data: {
        isOnline: astrologer.availability.isOnline,
        isAvailable: astrologer.availability.isAvailable,
        lastActive: astrologer.availability.lastActive
      }
    };
  }

  /**
   * Start live streaming
   */
  async startLiveStream(astrologerId: string): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // Check if profile is complete
    if (!astrologer.profileCompletion.isComplete) {
      throw new ForbiddenException({
        message: 'Please complete your profile before starting live stream',
        missingSteps: this.getMissingProfileSteps(astrologer.profileCompletion.steps)
      });
    }

    // Check if live streaming is enabled
    if (!astrologer.isLiveStreamEnabled) {
      throw new ForbiddenException('Live streaming is disabled. Contact support.');
    }

    // Check if already live
    if (astrologer.availability.isLive) {
      throw new BadRequestException({
        message: 'You are already live',
        liveStreamId: astrologer.availability.liveStreamId
      });
    }

    // Generate live stream session ID
    const liveStreamId = `live_${astrologerId}_${Date.now()}`;

    astrologer.availability.isLive = true;
    astrologer.availability.liveStreamId = liveStreamId;
    astrologer.availability.isOnline = true;
    astrologer.availability.isAvailable = true;
    astrologer.availability.lastActive = new Date();

    await astrologer.save();

    return {
      success: true,
      message: 'Live stream started successfully',
      data: {
        liveStreamId,
        astrologerId,
        astrologerName: astrologer.name,
        profilePicture: astrologer.profilePicture,
        specializations: astrologer.specializations,
        isLive: true,
        startedAt: new Date()
      }
    };
  }

  /**
   * Stop live streaming
   */
  async stopLiveStream(astrologerId: string): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    if (!astrologer.availability.isLive) {
      throw new BadRequestException('You are not currently live');
    }

    const previousStreamId = astrologer.availability.liveStreamId;

    astrologer.availability.isLive = false;
    astrologer.availability.liveStreamId = undefined;
    astrologer.availability.lastActive = new Date();

    await astrologer.save();

    return {
      success: true,
      message: 'Live stream stopped successfully',
      data: {
        liveStreamId: previousStreamId,
        stoppedAt: new Date()
      }
    };
  }

  private async checkAndUpdateProfileCompletion(astrologer: AstrologerDocument): Promise<void> {
    const steps = astrologer.profileCompletion.steps;
    
    // ✅ Fix: Only check required steps, ignoring new ones like gallery until they are live
    const allStepsComplete = 
      steps.basicInfo === true &&
      steps.expertise === true &&
      steps.pricing === true &&
      steps.availability === true;

    if (allStepsComplete && !astrologer.profileCompletion.isComplete) {
      astrologer.profileCompletion.isComplete = true;
      astrologer.profileCompletion.completedAt = new Date();

      // Enable services once profile is complete
      astrologer.isChatEnabled = true;
      astrologer.isCallEnabled = true;
      astrologer.isLiveStreamEnabled = true;

      // ✅ Make available
      astrologer.availability.isOnline = true;
      astrologer.availability.isAvailable = true;
      astrologer.availability.lastActive = new Date();

      this.logger.log(`✅ Profile completed for astrologer ${astrologer._id}`);
    }
  }

  /**
   * Helper: Get missing profile steps
   */
  private getMissingProfileSteps(steps: any): string[] {
    const missing: string[] = [];
    if (!steps.basicInfo) missing.push('Basic Information');
    if (!steps.expertise) missing.push('Expertise & Languages');
    if (!steps.pricing) missing.push('Pricing Setup');
    if (!steps.availability) missing.push('Availability & Working Hours');
    return missing;
  }

  // ✅ NEW: Delete Account Request
  async deleteAccount(astrologerId: string, reason?: string): Promise<any> {
    const astrologer = await this.astrologerModel.findById(astrologerId);

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    // Optional: Check for pending withdrawals or active live streams
    if (astrologer.earnings.pendingWithdrawal > 0) {
      throw new BadRequestException('Cannot delete account while you have pending withdrawals.');
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 2);

    // Update status
    astrologer.accountStatus = 'deleted';
    astrologer.permanentDeletionAt = deletionDate;
    astrologer.deletionReason = reason;

    // Immediately go offline
    astrologer.availability.isOnline = false;
    astrologer.availability.isAvailable = false;
    astrologer.availability.isLive = false;
    astrologer.devices = []; // Clear devices

    await astrologer.save();

    return {
      success: true,
      message: 'Account scheduled for deletion. It will be permanently removed in 48 hours.',
      data: {
        scheduledDate: deletionDate
      }
    };
  }

  // ✅ NEW: CRON Job for Astrologer cleanup
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledDeletions() {
    this.logger.log('Starting scheduled astrologer account deletion cleanup...');

    const now = new Date();

    const accountsToDelete = await this.astrologerModel.find({
      accountStatus: 'deleted',
      permanentDeletionAt: { $lte: now }
    }).select('_id registrationId'); // ✅ Include registrationId

    let deletedCount = 0;

    for (const acc of accountsToDelete) {
      try {
        await this.astrologerModel.deleteOne({ _id: acc._id });
        
        // ✅ Delete the associated registration document to allow re-registration
        if (acc.registrationId) {
          await this.registrationModel.deleteOne({ _id: acc.registrationId });
        }
        
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to delete astrologer ${acc._id}: ${error.message}`);
      }
    }

    this.logger.log(`Cleanup complete. Permanently deleted ${deletedCount} astrologer accounts.`);
  }
}
