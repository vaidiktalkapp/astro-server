import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MatrimonyProfile, MatrimonyProfileDocument } from '../schemas/matrimony-profile.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { MatrimonyInterest, MatrimonyInterestDocument } from '../schemas/matrimony-interest.schema';
import { NotificationService } from '../../notifications/services/notification.service';
import { MatrimonyChatService } from './matrimony-chat.service';

@Injectable()
export class MatrimonyService {
  constructor(
    @InjectModel(MatrimonyProfile.name) private profileModel: Model<MatrimonyProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(MatrimonyInterest.name) private interestModel: Model<MatrimonyInterestDocument>,
    private readonly astronomyService: AstronomyService,
    private readonly notificationService: NotificationService,
    private readonly chatService: MatrimonyChatService,
  ) {}

  private prepareDateStr(dob: any): string | null {
    if (!dob) return null;
    try {
        const date = new Date(dob);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch (e) {
        return null;
    }
  }

  async createOrUpdateProfile(userId: string, data: any): Promise<MatrimonyProfile> {
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { ...data, userId: new Types.ObjectId(userId) },
      { upsert: true, new: true },
    );
    return profile;
  }

  async getProfile(userId: string): Promise<MatrimonyProfile> {
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!profile) throw new NotFoundException('Matrimony profile not found');
    return profile;
  }

  async getSuggestions(userId: string, limit: number = 20, locationFilter?: string): Promise<any[]> {
    const currentUser = await this.userModel.findById(userId);
    if (!currentUser) throw new NotFoundException('User not found');

    const oppositeGender = currentUser.gender === 'male' ? 'female' : 'male';

    let matchCriteria: any = { isActive: true, userId: { $ne: new Types.ObjectId(userId) } };
    
    if (locationFilter) {
      matchCriteria.$or = [
        { bio: { $regex: locationFilter, $options: 'i' } },
        { "partnerPreferences.location": { $regex: locationFilter, $options: 'i' } }
      ];
    }

    // 1. Fetch active matrimony profiles of opposite gender
    const potentialMatches = await this.profileModel.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      { $match: { 'userDetails.gender': oppositeGender } },
      { $limit: limit * 2 }, // Get more to filter/sort later
    ]);

    // 2. Calculate Astrological compatibility for each (Guna Milan)
    const results = await Promise.all(
      potentialMatches.map(async (matchProfile) => {
        const partner = matchProfile.userDetails;
        
        let score = 0;
        let matchDetails: any = null;

        const bDate = this.prepareDateStr(currentUser.dateOfBirth);
        const gDate = this.prepareDateStr(partner.dateOfBirth);

        if (bDate && gDate) {
            try {
                const bInput = {
                    date: bDate,
                    time: currentUser.timeOfBirth || '12:00',
                    lat: 28.6139,
                    lon: 77.2090,
                    tzone: 5.5
                };
                const gInput = {
                    date: gDate,
                    time: partner.timeOfBirth || '12:00',
                    lat: 28.6139,
                    lon: 77.2090,
                    tzone: 5.5
                };

                const matchResult = await this.astronomyService.matchHoroscope(bInput, gInput);
                score = matchResult.total_points || 0;
                matchDetails = matchResult;
            } catch (err) {
                console.error(`[Matrimony] Match calculation failed for pair ${userId} <-> ${partner._id}:`, err.message);
            }
        }

        const isConnected = await this.checkConnection(userId, partner._id.toString());
        const phone = partner.phoneNumber;
        const maskedPhone = phone ? `${phone.substring(0, 3)}${'*'.repeat(phone.length - 7)}${phone.substring(phone.length - 4)}` : null;

        return {
          profile: matchProfile,
          user: {
              id: partner._id,
              name: partner.name,
              gender: partner.gender,
              age: this.calculateAge(partner.dateOfBirth),
              profileImage: (matchProfile.photos && matchProfile.photos.length > 0 && matchProfile.photos[0]) 
                ? matchProfile.photos[0] 
                : partner.profileImage,
              phoneNumber: isConnected ? phone : maskedPhone,
              isConnected: !!isConnected,
              connectionId: isConnected, // The string ID or null
          },
          compatibility: {
              score,
              label: this.getCompatibilityLabel(score),
              details: matchDetails
          }
        };
      })
    );

    // 3. Sort by compatibility score
    return results.sort((a, b) => b.compatibility.score - a.compatibility.score).slice(0, limit);
  }

  async getMatchDetails(userId: string, otherUserId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    const partner = await this.userModel.findById(otherUserId);
    const partnerProfile = await this.profileModel.findOne({ userId: new Types.ObjectId(otherUserId) });

    if (!user || !partner || !partnerProfile) {
        throw new NotFoundException('Partner profile not found');
    }

    let matchResult: any = null;
    const bDate = this.prepareDateStr(user.dateOfBirth);
    const gDate = this.prepareDateStr(partner.dateOfBirth);

    if (bDate && gDate) {
        try {
            const bInput = {
                date: bDate,
                time: user.timeOfBirth || '12:00',
                lat: 28.6139,
                lon: 77.2090,
                tzone: 5.5
            };
            const gInput = {
                date: gDate,
                time: partner.timeOfBirth || '12:00',
                lat: 28.6139,
                lon: 77.2090,
                tzone: 5.5
            };
            
            console.log('[Matrimony] Debug Match Input:', JSON.stringify({ bInput, gInput }));
            matchResult = await this.astronomyService.matchHoroscope(bInput, gInput);
            console.log('[Matrimony] Debug Match Result:', JSON.stringify(matchResult));
        } catch (err) {
            console.error('[Matrimony] Detailed Match Error:', err.message);
        }
    } else {
        console.log('[Matrimony] Missing Dates for Match:', { bDate, gDate });
    }

    const connectionId = await this.checkConnection(userId, otherUserId);
    const phone = partner.phoneNumber;
    const maskedPhone = phone ? `${phone.substring(0, 3)}${'*'.repeat(phone.length - 7)}${phone.substring(phone.length - 4)}` : null;

    // ── VEDIC PARTICULARS ──
    let vedicParticulars: any = null;
    if (gDate) {
        try {
            const partnerAstro = await this.astronomyService.calculateAllData(
                gDate,
                partner.timeOfBirth || '12:00',
                "28.6139",
                "77.2090",
                5.5
            );
            vedicParticulars = {
                nakshatra: partnerAstro.panchang?.nakshatra || 'Unknown',
                rashi: partnerAstro.panchang?.moon_sign || 'Unknown',
                lagna: partnerAstro.panchang?.sun_sign || 'Unknown',
                yoga: partnerAstro.panchang?.yoga,
                karana: partnerAstro.panchang?.karana
            };
        } catch (e) {
            console.warn('[Matrimony] Failed to fetch Vedic particulars for partner', otherUserId);
        }
    }

    return {
        partner: {
            id: partner._id,
            name: partner.name,
            gender: partner.gender,
            age: this.calculateAge(partner.dateOfBirth),
            profileImage: (partnerProfile.photos && partnerProfile.photos.length > 0 && partnerProfile.photos[0])
                ? partnerProfile.photos[0]
                : partner.profileImage,
            bio: partnerProfile.bio,
            profession: partnerProfile.profession,
            education: partnerProfile.education,
            religion: partnerProfile.religion,
            caste: partnerProfile.caste,
            height: partnerProfile.height,
            motherTongue: partnerProfile.motherTongue,
            hobbies: partnerProfile.hobbies,
            photos: partnerProfile.photos,
            phoneNumber: maskedPhone, // Always show masked phone
            isConnected: !!connectionId,
            connectionId: connectionId, // ID of the accepted interest for chat redirect
            dob: partner.dateOfBirth,
            tob: partner.timeOfBirth,
            pob: partner.placeOfBirth,
            vedicParticulars,
        },
        compatibility: matchResult
    };
  }

  private calculateAge(dob: Date | undefined): number {
      if (!dob) return 0;
      const diff = Date.now() - new Date(dob).getTime();
      return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  }

  private getCompatibilityLabel(score: number): string {
      if (score >= 30) return 'Divine Match';
      if (score >= 25) return 'Excellent';
      if (score >= 18) return 'Compatible';
      return 'Not Recommended';
  }

  // --- Admin Methods ---
  async getAllProfilesForAdmin(page: number = 1, limit: number = 20, search?: string) {
    const query: any = {};
    if (search) {
        // Will match against bio or profession
        query.$or = [
            { bio: { $regex: search, $options: 'i' } },
            { profession: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;
    
    const [profiles, total] = await Promise.all([
        this.profileModel.aggregate([
            { $match: query },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } }
        ]),
        this.profileModel.countDocuments(query)
    ]);

    return {
        profiles: profiles.map(p => ({
            ...p,
            user: p.userDetails ? {
                name: p.userDetails.name,
                phone: p.userDetails.phoneNumber,
                gender: p.userDetails.gender,
                profileImage: p.userDetails.profileImage
            } : null
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
  }

  async toggleProfileStatus(userId: string, isActive: boolean) {
    const profile = await this.profileModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { isActive },
        { new: true }
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async getAdminProfileById(userId: string) {
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).populate('userId');
    if (!profile) throw new NotFoundException('Profile not found');
    
    // Manual mapping for consistency with list view
    const p = profile.toObject();
    const userDetails = p.userId as any;
    
    return {
        ...p,
        user: userDetails ? {
            name: userDetails.name,
            phone: userDetails.phoneNumber,
            gender: userDetails.gender,
            profileImage: userDetails.profileImage
        } : null
    };
  }

  async updateAdminProfile(userId: string, data: any) {
    const profile = await this.profileModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { ...data },
        { new: true }
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  // --- INTEREST & CONNECTION SYSTEM ---

  async sendInterest(senderId: string, receiverId: string) {
    if (senderId === receiverId) throw new Error('Cannot send interest to yourself');

    const existing = await this.interestModel.findOne({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
    });

    if (existing) return existing;

    const interest = await this.interestModel.create({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      status: 'pending',
    });

    // Send Notification to Receiver (non-blocking — don't crash if it fails)
    try {
      const sender = await this.userModel.findById(senderId);
      await this.notificationService.sendNotification({
        recipientId: receiverId,
        recipientModel: 'User',
        title: 'New Matrimony interest!',
        message: `${sender?.name || 'Someone'} is interested in your profile. View and Accept to connect!`,
        type: 'matrimony_interest',
        data: { senderId },
      });
    } catch (notifErr) {
      console.error('[Matrimony] Failed to send interest notification:', notifErr.message);
    }

    return interest;
  }

  async handleInterestResponse(receiverId: string, requestId: string, status: 'accepted' | 'rejected') {
    const interest = await this.interestModel.findOneAndUpdate(
      { _id: new Types.ObjectId(requestId), receiverId: new Types.ObjectId(receiverId) },
      { status },
      { new: true },
    );

    if (!interest) throw new NotFoundException('Interest request not found');

    if (status === 'accepted') {
      // Increment Match counts first (critical operation)
      await this.profileModel.updateMany(
        { userId: { $in: [interest.senderId, interest.receiverId] } },
        { $inc: { matchCount: 1 } }
      );

      // Notify Sender (non-blocking — don't crash if it fails)
      try {
        const receiver = await this.userModel.findById(receiverId);
        await this.notificationService.sendNotification({
          recipientId: interest.senderId.toString(),
          recipientModel: 'User',
          title: 'Interest Accepted! 🎉',
          message: `${receiver?.name || 'Someone'} accepted your matrimony interest. You can now view their contact details!`,
          type: 'matrimony_match',
          data: { receiverId },
        });
      } catch (notifErr) {
        console.error('[Matrimony] Failed to send match notification:', notifErr.message);
      }
    }

    return interest;
  }

  async getInterests(userId: string, type: 'incoming' | 'outgoing') {
    const query = type === 'incoming' 
      ? { receiverId: new Types.ObjectId(userId) } 
      : { senderId: new Types.ObjectId(userId) };

    const interests = await this.interestModel.find(query)
      .populate('senderId', 'name profileImage phoneNumber')
      .populate('receiverId', 'name profileImage phoneNumber')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Map unread counts
    if (interests.length > 0) {
      const ids = interests.map(i => i._id.toString());
      const unreadCounts = await this.chatService.getUnreadCountsForInterests(userId, ids);
      
      return interests.map(i => ({
        ...i,
        unreadCount: unreadCounts[i._id.toString()] || 0
      }));
    }

    return interests;
  }

  async checkConnection(user1: string, user2: string): Promise<string | null> {
    const connection = await this.interestModel.findOne({
      $or: [
        { senderId: new Types.ObjectId(user1), receiverId: new Types.ObjectId(user2), status: 'accepted' },
        { senderId: new Types.ObjectId(user2), receiverId: new Types.ObjectId(user1), status: 'accepted' },
      ],
    });
    return connection ? connection._id.toString() : null;
  }
}

