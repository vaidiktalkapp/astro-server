import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Astrologer, AstrologerDocument } from '../schemas/astrologer.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class AstrologerBlockingService {
  private readonly logger = new Logger(AstrologerBlockingService.name);

  constructor(
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // Block a User
  async blockUser(astrologerId: string, userId: string, reason: string = 'Astrologer blocked this user') {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID');
    }

    const astrologer = await this.astrologerModel.findById(astrologerId).select('+blockedUsers');
    if (!astrologer) throw new NotFoundException('Astrologer not found');

    // Check if user exists
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if already blocked
    const isBlocked = astrologer.blockedUsers?.some(
      (b) => b.userId.toString() === userId
    );

    if (isBlocked) {
      return { success: true, message: 'User is already blocked' };
    }

    // Push to blocked list
    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $push: {
        blockedUsers: {
          userId: new Types.ObjectId(userId),
          reason,
          blockedAt: new Date(),
        },
      },
    });

    this.logger.log(`Astrologer ${astrologerId} blocked User ${userId}`);

    return { success: true, message: 'User blocked successfully' };
  }

  // Unblock a User
  async unblockUser(astrologerId: string, userId: string) {
    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $pull: {
        blockedUsers: { userId: new Types.ObjectId(userId) },
      },
    });

    return { success: true, message: 'User unblocked successfully' };
  }

  // Get Blocked Users List
  async getBlockedUsers(astrologerId: string) {
    const astrologer = await this.astrologerModel.findById(astrologerId)
      .select('blockedUsers')
      .populate({
        path: 'blockedUsers.userId',
        model: 'User',
        select: 'name profilePicture gender', // Select limited fields
      })
      .lean();

    if (!astrologer) throw new NotFoundException('Astrologer not found');

    return {
      success: true,
      data: astrologer.blockedUsers || [],
    };
  }

  // Check if a specific user is blocked (Helper for other services)
  async isUserBlocked(astrologerId: string, userId: string): Promise<boolean> {
    const astrologer = await this.astrologerModel.findById(astrologerId)
        .select('+blockedUsers') // ✅ FIX: '+' required because field has select:false in schema
        .lean();
        
    return astrologer?.blockedUsers?.some(b => b.userId.toString() === userId.toString()) || false;
  }

  // ─────────────────────────────────────────────────────────
  // ✅ STREAM-ONLY BLOCK — Chat & Call unaffected
  // ─────────────────────────────────────────────────────────

  // Block user only from Live Streams (not from chat/call)
  async blockUserFromStream(astrologerId: string, userId: string, reason: string = 'Kicked from live stream') {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID');
    }

    const astrologer = await this.astrologerModel.findById(astrologerId).select('+streamBlockedUsers');
    if (!astrologer) throw new NotFoundException('Astrologer not found');

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if already stream-blocked
    const isAlreadyBlocked = astrologer.streamBlockedUsers?.some(
      (b) => b.userId.toString() === userId
    );

    if (isAlreadyBlocked) {
      return { success: true, message: 'User is already stream-blocked' };
    }

    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $push: {
        streamBlockedUsers: {
          userId: new Types.ObjectId(userId),
          reason,
          blockedAt: new Date(),
        },
      },
    });

    this.logger.log(`Astrologer ${astrologerId} stream-blocked User ${userId}`);
    return { success: true, message: 'User blocked from live streams successfully' };
  }

  // Unblock user from Live Streams only
  async unblockUserFromStream(astrologerId: string, userId: string) {
    await this.astrologerModel.findByIdAndUpdate(astrologerId, {
      $pull: {
        streamBlockedUsers: { userId: new Types.ObjectId(userId) },
      },
    });

    this.logger.log(`Astrologer ${astrologerId} stream-unblocked User ${userId}`);
    return { success: true, message: 'User unblocked from live streams successfully' };
  }

  // Check if user is stream-blocked (used by streaming gateway only)
  async isUserStreamBlocked(astrologerId: string, userId: string): Promise<boolean> {
    const astrologer = await this.astrologerModel.findById(astrologerId)
      .select('+streamBlockedUsers')
      .lean();

    return astrologer?.streamBlockedUsers?.some(
      (b) => b.userId.toString() === userId.toString()
    ) || false;
  }

  // Get list of stream-blocked users
  async getStreamBlockedUsers(astrologerId: string) {
    const astrologer = await this.astrologerModel.findById(astrologerId)
      .select('+streamBlockedUsers')
      .populate({
        path: 'streamBlockedUsers.userId',
        model: 'User',
        select: 'name profilePicture gender',
      })
      .lean();

    if (!astrologer) throw new NotFoundException('Astrologer not found');

    return {
      success: true,
      data: astrologer.streamBlockedUsers || [],
    };
  }
}