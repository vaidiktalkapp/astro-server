import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../../../../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { ChatSession, ChatSessionDocument } from '../../../../chat/schemas/chat-session.schema';
import { ChatMessage, ChatMessageDocument } from '../../../../chat/schemas/chat-message.schema';
import { CallSession, CallSessionDocument } from '../../../../calls/schemas/call-session.schema';
import { WalletTransaction, WalletTransactionDocument } from '../../../../payments/schemas/wallet-transaction.schema';
import { AdminNotificationGateway } from '../../notifications/gateways/admin-notification.gateway';
import { User, UserDocument } from '../../../../users/schemas/user.schema';

@Injectable()
export class AdminAiAstrologersService {
    private readonly logger = new Logger(AdminAiAstrologersService.name);

    constructor(
        @InjectModel(AiAstrologerProfile.name) private aiProfileModel: Model<AiAstrologerProfileDocument>,
        @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
        @InjectModel(ChatMessage.name) private messageModel: Model<ChatMessageDocument>,
        @InjectModel(CallSession.name) private callSessionModel: Model<CallSessionDocument>,
        @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly notificationGateway: AdminNotificationGateway,
    ) { }

    // ===== 1. AI ASTROLOGER MANAGEMENT (CRUD) =====

    async create(data: any): Promise<any> {
        this.logger.log(`🏗️ Creating AI Astrologer with data: ${JSON.stringify(data)}`);
        // Map DTO fields if necessary
        if (data.personality && !data.personalityType) data.personalityType = data.personality;
        if (data.profilePicture && !data.image) data.image = data.profilePicture;
        if (data.experienceYears && data.experience === undefined) data.experience = data.experienceYears;
        if (data.specializations && !data.specialization) data.specialization = data.specializations;
        if (data.pricing?.chat !== undefined && data.ratePerMinute === undefined) data.ratePerMinute = data.pricing.chat;
        if (data.chatRatePerMinute === undefined) data.chatRatePerMinute = data.pricing?.chat ?? data.ratePerMinute ?? 0;
        if (data.callRatePerMinute === undefined) data.callRatePerMinute = data.pricing?.call ?? data.ratePerMinute ?? 0;

        this.logger.debug(`📝 Normalized data for creation: ${JSON.stringify(data)}`);

        const newProfile = new this.aiProfileModel(data);
        const saved = await newProfile.save();

        this.notificationGateway.notifyRealtimeActivity({
            type: 'system',
            message: `New AI Astrologer created: ${saved.name}`,
            data: { id: saved._id, name: saved.name }
        });
        return saved;
    }

    async findAll(query: any): Promise<any> {
        const { page = 1, limit = 20, search, status } = query;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        if (status && status !== 'all') {
            if (status === 'active') filter.isAvailable = true;
            if (status === 'inactive') filter.isAvailable = false;
        }

        const [rawProfiles, total] = await Promise.all([
            this.aiProfileModel.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }).lean(),
            this.aiProfileModel.countDocuments(filter)
        ]);

        const astrologers = rawProfiles.map(profile => this.mapProfileForAdmin(profile));
        const totalPages = Math.ceil(total / limit);

        return {
            astrologers,
            profiles: astrologers, // Alias
            items: astrologers, // Alias
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    async findOne(id: string): Promise<any> {
        const profile = await this.aiProfileModel.findById(id).lean();
        if (!profile) throw new NotFoundException('AI Astrologer not found');
        return this.mapProfileForAdmin(profile);
    }

    private mapProfileForAdmin(profile: any) {
        if (!profile) return null;
        const obj = profile.toObject ? profile.toObject() : profile;

        return {
            ...obj,
            _id: obj._id?.toString(),
            id: obj._id?.toString(),
            profilePicture: obj.image,
            experienceYears: obj.experience,
            specializations: obj.specialization,
            expertise: obj.expertise,
            isOnline: obj.isAvailable,
            accountStatus: obj.isAvailable ? 'active' : 'inactive',
            isChatEnabled: obj.isChatEnabled ?? true,
            isCallEnabled: obj.isCallEnabled ?? true,
            chatRatePerMinute: obj.chatRatePerMinute ?? obj.ratePerMinute ?? 0,
            callRatePerMinute: obj.callRatePerMinute ?? obj.ratePerMinute ?? 0,
            pricing: {
                chat: obj.chatRatePerMinute ?? obj.ratePerMinute ?? 0,
                call: obj.callRatePerMinute ?? obj.ratePerMinute ?? 0,
                videoCall: 0
            },
            ratePerMinute: obj.ratePerMinute || 0,
            displayName: obj.name,
            totalOrders: obj.totalSessions || 0,
            totalEarnings: obj.totalRevenue || 0,
            gender: obj.gender || 'male',
            voiceProvider: obj.voiceProvider || 'vapi',
            voiceId: obj.voiceId || 'pMSpe79Vf0vVp3n37rV6'
        };
    }

    async updateStatus(id: string, status: string) {
        // Assuming status 'active' maps to isAvailable=true
        const isAvailable = status === 'active';
        return this.update(id, { isAvailable });
    }

    async update(id: string, data: any): Promise<any> {
        this.logger.log(`update: Updating AI Astrologer ${id} with data: ${JSON.stringify(data)}`);
        if (data.personality && !data.personalityType) data.personalityType = data.personality;
        if (data.profilePicture && !data.image) data.image = data.profilePicture;
        if (data.experienceYears !== undefined && data.experience === undefined) data.experience = data.experienceYears;
        if (data.specializations && !data.specialization) data.specialization = data.specializations;
        if (data.pricing?.chat !== undefined && data.ratePerMinute === undefined) data.ratePerMinute = data.pricing.chat;
        if (data.chatRatePerMinute === undefined) data.chatRatePerMinute = data.pricing?.chat ?? data.ratePerMinute ?? 0;
        if (data.callRatePerMinute === undefined) data.callRatePerMinute = data.pricing?.call ?? data.ratePerMinute ?? 0;

        this.logger.debug(`📝 Normalized data for update: ${JSON.stringify(data)}`);

        const updated = await this.aiProfileModel.findByIdAndUpdate(id, { $set: data }, { new: true });
        if (!updated) throw new NotFoundException('AI Astrologer not found');

        this.notificationGateway.notifyRealtimeActivity({
            type: 'system',
            message: `AI Astrologer updated: ${updated.name}`,
            data: { id, name: updated.name }
        });

        return this.mapProfileForAdmin(updated);
    }

    async delete(id: string): Promise<any> {
        const profile = await this.aiProfileModel.findById(id);
        if (!profile) throw new NotFoundException('AI Astrologer not found');
        const name = profile.name;
        await this.aiProfileModel.findByIdAndDelete(id);

        this.notificationGateway.notifyRealtimeActivity({
            type: 'system',
            message: `AI Astrologer deleted: ${name}`,
            data: { id, name }
        });
        return { success: true, message: 'AI Astrologer deleted' };
    }

    async toggleAvailability(id: string): Promise<any> {
        const profile = await this.aiProfileModel.findById(id);
        if (!profile) throw new NotFoundException('AI Astrologer not found');
        profile.isAvailable = !profile.isAvailable;
        const saved = await profile.save();

        this.notificationGateway.notifyRealtimeActivity({
            type: 'system',
            message: `AI Astrologer ${saved.name} is now ${saved.isAvailable ? 'Online' : 'Offline'}`,
            data: { id, name: saved.name, isAvailable: saved.isAvailable }
        });
        return saved;
    }

    // ===== 2. ANALYTICS & PERFORMANCE =====

    async getQuickStats(): Promise<any> {
        // Use Asia/Kolkata timezone for "Today" vs "Yesterday"
        const getISTNow = () => {
            const now = new Date();
            const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            return new Date(istString);
        };

        const istNow = getISTNow();
        const istNowTime = istNow.getTime();
        
        // Boundaries in IST
        const startOfTodayIST = new Date(istNow);
        startOfTodayIST.setHours(0, 0, 0, 0);

        const startOfYesterdayIST = new Date(startOfTodayIST);
        startOfYesterdayIST.setDate(startOfTodayIST.getDate() - 1);

        const sameTimeYesterdayIST = new Date(istNow);
        sameTimeYesterdayIST.setDate(istNow.getDate() - 1);

        // Convert IST boundaries back to UTC for MongoDB queries
        const istOffset = 5.5 * 60 * 60 * 1000;
        const startOfTodayUtc = new Date(startOfTodayIST.getTime() - istOffset);
        const endOfTodayUtc = new Date(istNowTime - istOffset);
        
        const startOfYesterdayUtc = new Date(startOfYesterdayIST.getTime() - istOffset);
        const sameTimeYesterdayUtc = new Date(sameTimeYesterdayIST.getTime() - istOffset);

        const [
            totalAI,
            activeAI,
            totalChatSessions,
            totalCallSessions,
            chatRevenueStats,
            callRevenueStats,
            chatDurationStats,
            callDurationStats,
            uniqueChatUsers,
            uniqueCallUsers,
            todayChatSessions,
            todayCallSessions,
            yesterdayChatSessions,
            yesterdayCallSessions
        ] = await Promise.all([
            this.aiProfileModel.countDocuments(),
            this.aiProfileModel.countDocuments({ isAvailable: true }),
            this.sessionModel.countDocuments({ orderId: /AI-/ }),
            this.callSessionModel.countDocuments({ isAi: true }),
            this.sessionModel.aggregate([
                { $match: { orderId: /AI-/, status: 'ended' } },
                { $group: { _id: null, total: { $sum: "$totalCost" } } }
            ]),
            this.callSessionModel.aggregate([
                { $match: { isAi: true, status: 'ended' } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]),
            this.sessionModel.aggregate([
                { $match: { orderId: /AI-/ } },
                { $group: { _id: null, avgDuration: { $avg: "$duration" } } }
            ]),
            this.callSessionModel.aggregate([
                { $match: { isAi: true } },
                { $group: { _id: null, avgDuration: { $avg: "$duration" } } }
            ]),
            this.sessionModel.distinct('userId', { orderId: /AI-/ }),
            this.callSessionModel.distinct('userId', { isAi: true }),
            // Today so far
            this.sessionModel.countDocuments({ orderId: /AI-/, createdAt: { $gte: startOfTodayUtc, $lte: endOfTodayUtc } }),
            this.callSessionModel.countDocuments({ isAi: true, createdAt: { $gte: startOfTodayUtc, $lte: endOfTodayUtc } }),
            // Yesterday UP TO THE SAME TIME (Fair comparison)
            this.sessionModel.countDocuments({ orderId: /AI-/, createdAt: { $gte: startOfYesterdayUtc, $lt: sameTimeYesterdayUtc } }),
            this.callSessionModel.countDocuments({ isAi: true, createdAt: { $gte: startOfYesterdayUtc, $lt: sameTimeYesterdayUtc } })
        ]);

        const chatRevenue = chatRevenueStats[0]?.total || 0;
        const callRevenue = callRevenueStats[0]?.total || 0;
        const totalRevenue = chatRevenue + callRevenue;
        const totalSessions = totalChatSessions + totalCallSessions;
        const todaySessions = todayChatSessions + todayCallSessions;
        const yesterdaySessions = yesterdayChatSessions + yesterdayCallSessions;

        let growthRate = 0;
        if (yesterdaySessions > 0) {
            growthRate = ((todaySessions - yesterdaySessions) / yesterdaySessions) * 100;
        } else if (todaySessions > 0) {
            growthRate = 100;
        }
        
        const avgChatDur = chatDurationStats[0]?.avgDuration || 0;
        const avgCallDur = callDurationStats[0]?.avgDuration || 0;
        let averageSessionDuration = 0;
        if (totalSessions > 0) {
            averageSessionDuration = Math.round(((avgChatDur * totalChatSessions) + (avgCallDur * totalCallSessions)) / totalSessions);
        }

        return {
            totalAI,
            activeAI,
            totalSessions,
            totalChatSessions,
            totalCallSessions,
            totalRevenue,
            chatRevenue,
            callRevenue,
            averageChatDuration: Math.round(avgChatDur),
            averageCallDuration: Math.round(avgCallDur),
            averageSessionDuration,
            totalUsers: new Set([...uniqueChatUsers.map(u => u.toString()), ...uniqueCallUsers.map(u => u.toString())]).size,
            growthRate: parseFloat(growthRate.toFixed(1))
        };
    }

    async getPerformanceMetrics(): Promise<any> {
        const profiles = await this.aiProfileModel.find()
            .select('name rating totalSessions averageSessionDuration satisfactionScore totalRevenue averageLatency averageAccuracy viewCount')
            .sort({ rating: -1 })
            .lean();

        const metrics = profiles.map(profile => {
            const totalSessions = (profile as any).totalSessions || 0;
            const viewCount = (profile as any).viewCount || totalSessions;

            const conversionRate = viewCount > 0
                ? (totalSessions / Math.max(viewCount, totalSessions)) * 100
                : 0;

            return {
                ...profile,
                conversionRate: parseFloat(conversionRate.toFixed(1))
            };
        });

        return { items: metrics };
    }

    async getOverallStats(timeRange: string = 'monthly'): Promise<any> {
        const { start, end, groupByFormat } = this.getTimeRangeDates(timeRange);

        const [revenueData, hourlyData] = await Promise.all([
            this.sessionModel.aggregate([
                {
                    $match: {
                        $or: [
                            { astrologerModel: 'AiAstrologerProfile' },
                            { orderId: /^AI-/ }
                        ],
                        status: 'ended',
                        endTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: groupByFormat, date: "$endTime", timezone: 'Asia/Kolkata' } },
                        sessions: { $sum: 1 },
                        revenue: { $sum: "$totalCost" }
                    }
                },
                { $project: { date: "$_id", sessions: 1, revenue: 1, _id: 0 } },
                { $sort: { "date": 1 } }
            ]),
            this.sessionModel.aggregate([
                {
                    $match: {
                        $or: [
                            { astrologerModel: 'AiAstrologerProfile' },
                            { orderId: /^AI-/ }
                        ],
                        startTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: { $hour: { date: "$startTime", timezone: 'Asia/Kolkata' } },
                        sessions: { $sum: 1 }
                    }
                },
                { $project: { hour: "$_id", sessions: 1, _id: 0 } },
                { $sort: { "hour": 1 } }
            ])
        ]);

        // Fill gaps for revenue chart
        const revenueChart = this.fillDateGaps(revenueData, start, end, timeRange);

        // Fill gaps for peak hours (Ensure all 24 hours are represented)
        const peakHours: any[] = [];
        for (let h = 0; h < 24; h++) {
            const hourData = hourlyData.find(item => item.hour === h);
            peakHours.push({
                hour: h.toString(),
                sessions: hourData?.sessions || 0,
            });
        }

        return { revenueChart, peakHours };
    }

    // ===== 3. CHAT LOGS & INTERACTIONS =====

    async getChatLogs(query: any): Promise<any> {
        const { page = 1, limit = 20, search, aiAstrologerId, status } = query;
        const skip = (page - 1) * limit;

        const filter: any = { orderId: /AI-/ };
        if (aiAstrologerId) filter.astrologerId = new Types.ObjectId(aiAstrologerId);
        if (status) filter.status = status;

        if (search) {
            const userFilter = { name: { $regex: search, $options: 'i' } };
            const users = await this.userModel.find(userFilter).select('_id').lean();
            const userIds = users.map(u => u._id);

            filter.$or = [
                { sessionId: { $regex: search, $options: 'i' } },
                { orderId: { $regex: search, $options: 'i' } },
                { userId: { $in: userIds } }
            ];
        }

        const [logs, total] = await Promise.all([
            this.sessionModel.find(filter)
                .populate('userId', 'name email image avatar profilePicture')
                .populate('astrologerId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            this.sessionModel.countDocuments(filter)
        ]);

        return {
            items: logs.map(log => this.mapLogForAdmin(log)),
            logs: logs.map(log => this.mapLogForAdmin(log)), // Alias
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        };
    }

    private mapLogForAdmin(log: any) {
        return {
            _id: log._id,
            sessionId: log.sessionId,
            userName: log.userId?.name || 'Unknown',
            userProfile: log.userId?.image || log.userId?.avatar || log.userId?.profilePicture,
            aiAstrologerId: log.astrologerId?._id,
            aiAstrologerName: log.astrologerId?.name,
            duration: Math.round((log.duration || 0) / 60),
            messages: log.messageCount || 0,
            rating: log.userSatisfactionRating,
            earnings: log.totalCost || 0,
            resolution: log.status === 'ended' ? 'resolved' : log.status,
            auditStatus: log.auditStatus || 'pending',
            createdAt: log.createdAt
        };
    }

    async getChatLogDetails(id: string): Promise<any> {
        // Handle both ObjectId and sessionId string
        const filter = Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : { sessionId: id };

        const session = await this.sessionModel.findOne(filter)
            .populate('userId', 'name email avatar profilePicture')
            .populate('astrologerId', 'name image')
            .lean();

        if (!session) throw new NotFoundException('Session not found');

        const messages = await this.messageModel.find({
            $or: [
                { sessionId: session.sessionId },
                { orderId: session.orderId },
                { sessionId: id } // Fallback for direct matches
            ]
        }).sort({ sentAt: 1 }).lean();

        return { ...session, messages };
    }

    async getChatMessages(sessionId: string): Promise<any> {
        return this.messageModel.find({ sessionId }).sort({ sentAt: 1 }).lean();
    }

    async getCallLogs(query: any): Promise<any> {
        const { page = 1, limit = 20, search, aiAstrologerId, status } = query;
        const skip = (page - 1) * limit;

        const allCount = await this.callSessionModel.countDocuments({});
        this.logger.log(`🔍 Total Call Sessions in DB: ${allCount}`);

        const filter: any = {
            $or: [
                { isAi: true },
                { orderId: { $regex: /^AI[_-]/i } },
                { sessionId: { $regex: /^AI_VOICE/i } }
            ]
        };

        if (status) filter.status = status;

        if (aiAstrologerId) {
            filter.astrologerId = new Types.ObjectId(aiAstrologerId);
        }

        const pipeline: any[] = [{ $match: filter }];

        // Add search filter if provided
        if (search) {
            pipeline.push(
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'searchUser'
                    }
                },
                { $unwind: { path: '$searchUser', preserveNullAndEmptyArrays: true } },
                {
                    $match: {
                        $or: [
                            { sessionId: { $regex: search, $options: 'i' } },
                            { orderId: { $regex: search, $options: 'i' } },
                            { 'searchUser.name': { $regex: search, $options: 'i' } }
                        ]
                    }
                }
            );
        }

        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit as any) }
        );

        const logs = await this.callSessionModel.aggregate([
            ...pipeline,
            // 1. Join with Users
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userData'
                }
            },
            { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
            // 2. Join with AI Profiles
            {
                $lookup: {
                    from: 'ai_astrologer_profiles',
                    localField: 'astrologerId',
                    foreignField: '_id',
                    as: 'aiData'
                }
            },
            { $unwind: { path: '$aiData', preserveNullAndEmptyArrays: true } },
            // 3. Join with Human Astrologers
            {
                $lookup: {
                    from: 'astrologers',
                    localField: 'astrologerId',
                    foreignField: '_id',
                    as: 'humanData'
                }
            },
            { $unwind: { path: '$humanData', preserveNullAndEmptyArrays: true } },
            // 4. Map the final fields
            {
                $project: {
                    _id: 1,
                    sessionId: 1,
                    userId: 1,
                    astrologerId: 1,
                    orderId: 1,
                    isAi: 1,
                    status: 1,
                    startTime: 1,
                    endTime: 1,
                    duration: 1,
                    billedMinutes: 1,
                    totalAmount: 1,
                    ratePerMinute: 1,
                    recordingUrl: 1,
                    hasRecording: 1,
                    transcript: 1,
                    auditStatus: 1,
                    endedBy: 1,
                    endReason: 1,
                    totalCost: 1,
                    createdAt: 1,
                    userName: '$userData.name',
                    userEmail: '$userData.email',
                    aiAstrologerName: { $ifNull: ['$aiData.name', '$humanData.name'] },
                    astrologerImage: { $ifNull: ['$aiData.image', '$humanData.profilePicture'] }
                }
            }
        ]);

        // Calculate total count (considering search)
        let total = 0;
        if (search) {
            const countPipeline: any[] = [{ $match: filter }];
            countPipeline.push(
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'searchUser'
                    }
                },
                { $unwind: { path: '$searchUser', preserveNullAndEmptyArrays: true } },
                {
                    $match: {
                        $or: [
                            { sessionId: { $regex: search, $options: 'i' } },
                            { orderId: { $regex: search, $options: 'i' } },
                            { 'searchUser.name': { $regex: search, $options: 'i' } }
                        ]
                    }
                },
                { $count: 'total' }
            );
            const countResult = await this.callSessionModel.aggregate(countPipeline);
            total = countResult[0]?.total || 0;
        } else {
            total = await this.callSessionModel.countDocuments(filter);
        }

        return {
            items: logs.map(log => ({
                ...log,
                userName: log.userName || 'Unknown',
                aiAstrologerName: log.aiAstrologerName || 'AI Astrologer',
            })),
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        };
    }

    async getCallLogDetails(id: string): Promise<any> {
        const filter = Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : { sessionId: id };
        const session = await this.callSessionModel.findOne(filter)
            .populate('userId', 'name email avatar profilePicture')
            .populate('astrologerId', 'name image')
            .lean();

        if (!session) throw new NotFoundException('Call Session not found');

        const userData = session.userId as any;
        const astrologerData = session.astrologerId as any;

        return {
            ...session,
            userName: userData?.name || 'Unknown User',
            userEmail: userData?.email || '',
            aiAstrologerName: astrologerData?.name || 'AI Astrologer',
            astrologerImage: astrologerData?.image || astrologerData?.profilePicture || '',
        };
    }

    async getChatStatistics(): Promise<any> {
        const [stats, statusGroups, ratingStats] = await Promise.all([
            this.getQuickStats(),
            this.sessionModel.aggregate([
                { $match: { orderId: /AI-/ } },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            this.sessionModel.aggregate([
                { $match: { orderId: /AI-/, userSatisfactionRating: { $exists: true, $ne: null } } },
                { $group: { _id: null, avgRating: { $avg: "$userSatisfactionRating" } } }
            ])
        ]);

        return {
            totalChats: stats.totalSessions,
            totalRevenue: stats.totalRevenue,
            avgDuration: stats.averageSessionDuration,
            avgRating: parseFloat((ratingStats[0]?.avgRating || 0).toFixed(1)) || 4.5,
            statusGroups
        };
    }

    // ===== 4. WALLET & BILLING =====

    async getTransactions(query: any): Promise<any> {
        const { page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        const filter = {
            $or: [
                { description: /AI Chat/i },
                { description: /AI Voice/i }
            ]
        };

        const [items, total] = await Promise.all([
            this.transactionModel.find(filter)
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            this.transactionModel.countDocuments(filter)
        ]);

        const formattedItems = items.map(txn => {
            let astroName = 'Unknown AI';
            if (txn.description && txn.description.includes('with ')) {
                astroName = txn.description.split('with ')[1];
            } else if (txn.description && txn.description.includes(' - ')) {
                astroName = txn.description.split(' - ')[1];
            }
            return {
                ...txn,
                userName: (txn.userId as any)?.name || 'Unknown',
                userEmail: (txn.userId as any)?.email,
                aiAstrologerId: { name: astroName },
                isVoice: txn.description?.includes('Voice')
            };
        });

        return {
            items: formattedItems,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        };
    }

    async getWalletStats(): Promise<any> {
        const stats = await this.transactionModel.aggregate([
            { 
                $match: { 
                    $or: [
                        { description: /AI Chat/i },
                        { description: /AI Voice/i }
                    ]
                } 
            },
            { 
                $group: { 
                    _id: {
                        type: "$type",
                        isVoice: { $regexMatch: { input: "$description", regex: /AI Voice/i } }
                    },
                    total: { $sum: "$amount" }, 
                    count: { $sum: 1 } 
                } 
            }
        ]);
        return stats;
    }

    // ===== 5. EXPORT =====

    async exportProfiles(): Promise<string> {
        const profiles = await this.aiProfileModel.find().lean();
        return this.jsonToCsv(profiles, ['name', 'personalityType', 'rating', 'totalSessions', 'isAvailable']);
    }

    async exportChats(): Promise<string> {
        const chats = await this.sessionModel.find({ orderId: /AI-/ }).lean();
        return this.jsonToCsv(chats, ['sessionId', 'userId', 'astrologerId', 'status', 'totalCost', 'duration']);
    }

    async exportBilling(): Promise<string> {
        const txns = await this.transactionModel.find({ description: /AI Chat/i }).lean();
        return this.jsonToCsv(txns, ['transactionId', 'userId', 'amount', 'type', 'status', 'createdAt']);
    }

    private jsonToCsv(data: any[], fields: string[]): string {
        const header = fields.join(',') + '\n';
        const rows = data.map(item => {
            return fields.map(field => {
                let val = item[field];
                if (val instanceof Date) val = val.toISOString();
                if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
                return val ?? '';
            }).join(',');
        }).join('\n');
        return header + rows;
    }

    // ===== 6. ENHANCED ANALYTICS (Moved from AnalyticsService) =====

    private fillDateGaps(data: any[], start: Date, end: Date, timeRange: string) {
        const filledData: any[] = [];
        const dataMap = new Map(data.map((item) => [item.date || item._id, item]));

        const current = new Date(start);

        while (current <= end) {
            const dateStr = this.formatDateForTimeRange(current, timeRange);
            const existing = dataMap.get(dateStr);

            filledData.push({
                date: dateStr,
                revenue: existing?.revenue || existing?.totalRevenue || 0,
                sessions: existing?.sessions || existing?.totalSessions || 0,
                avgDuration: existing?.avgDuration || 0,
            });

            // Increment based on time range
            if (timeRange === 'daily') {
                current.setHours(current.getHours() + 1);
            } else if (timeRange === 'yearly') {
                current.setMonth(current.getMonth() + 1);
            } else {
                current.setDate(current.getDate() + 1);
            }
        }

        return filledData;
    }

    private fillDateGapsCombined(data: any[], start: Date, end: Date, timeRange: string) {
        const filledData: any[] = [];
        const dataMap = new Map(data.map((item) => [item.date, item]));

        const current = new Date(start);

        while (current <= end) {
            const dateStr = this.formatDateForTimeRange(current, timeRange);
            const existing = dataMap.get(dateStr);

            filledData.push({
                date: dateStr,
                chatRevenue: existing?.chatRevenue || 0,
                chatSessions: existing?.chatSessions || 0,
                callRevenue: existing?.callRevenue || 0,
                callSessions: existing?.callSessions || 0,
                totalRevenue: (existing?.chatRevenue || 0) + (existing?.callRevenue || 0),
                totalSessions: (existing?.chatSessions || 0) + (existing?.callSessions || 0),
            });

            // Increment based on time range
            if (timeRange === 'daily') {
                current.setHours(current.getHours() + 1);
            } else if (timeRange === 'yearly') {
                current.setMonth(current.getMonth() + 1);
            } else {
                current.setDate(current.getDate() + 1);
            }
        }

        return filledData;
    }
    private formatDateForTimeRange(date: Date, timeRange: string): string {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffset);

        if (timeRange === 'daily') {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')} ${String(istDate.getHours()).padStart(2, '0')}:00`;
        } else if (timeRange === 'yearly') {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}`;
        } else {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
        }
    }

    private getTimeRangeDates(timeRange: string, startDate?: string, endDate?: string) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        
        // Get current time in IST
        const getISTNow = () => {
            const now = new Date();
            return new Date(now.getTime() + istOffset);
        };

        const istNow = getISTNow();
        let startIST: Date;
        let endIST: Date = new Date(istNow);
        let groupByFormat: string;

        if (timeRange === 'custom' && startDate && endDate) {
            startIST = new Date(new Date(startDate).getTime() + istOffset);
            endIST = new Date(new Date(endDate).getTime() + istOffset);
            groupByFormat = '%Y-%m-%d';
        } else {
            switch (timeRange) {
                case 'daily':
                    startIST = new Date(istNow);
                    startIST.setUTCHours(0, 0, 0, 0); // Using setUTCHours because we are working with offset-adjusted "fake UTC"
                    groupByFormat = '%Y-%m-%d %H:00';
                    break;
                case 'weekly':
                case 'last7days':
                    startIST = new Date(istNow);
                    startIST.setUTCDate(istNow.getUTCDate() - 7);
                    startIST.setUTCHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'last30days':
                    startIST = new Date(istNow);
                    startIST.setUTCDate(istNow.getUTCDate() - 30);
                    startIST.setUTCHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'monthly':
                    startIST = new Date(istNow);
                    startIST.setUTCDate(1);
                    startIST.setUTCHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'yearly':
                    startIST = new Date(istNow);
                    startIST.setUTCMonth(0, 1);
                    startIST.setUTCHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m';
                    break;
                default:
                    startIST = new Date(istNow);
                    startIST.setUTCDate(istNow.getUTCDate() - 30);
                    startIST.setUTCHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d';
            }
        }

        endIST.setUTCHours(23, 59, 59, 999);

        // Convert back to real UTC for DB
        const startUtc = new Date(startIST.getTime() - istOffset);
        const endUtc = new Date(endIST.getTime() - istOffset);

        return { start: startUtc, end: endUtc, groupByFormat };
    }

    async getAIRevenueAnalytics(timeRange: string, startDate?: string, endDate?: string): Promise<any> {
        try {
            const { start, end, groupByFormat } = this.getTimeRangeDates(timeRange, startDate, endDate);

            const [chatData, callData] = await Promise.all([
                this.sessionModel.aggregate([
                    {
                        $match: {
                            $or: [
                                { astrologerModel: 'AiAstrologerProfile' },
                                { orderId: /^AI-/ }
                            ],
                            status: 'ended',
                            endTime: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: groupByFormat, date: '$endTime', timezone: 'Asia/Kolkata' } },
                            revenue: { $sum: "$totalCost" },
                            sessions: { $sum: 1 },
                        },
                    }
                ]),
                this.callSessionModel.aggregate([
                    {
                        $match: {
                            isAi: true,
                            status: 'ended',
                            endTime: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: groupByFormat, date: '$endTime', timezone: 'Asia/Kolkata' } },
                            revenue: { $sum: "$totalAmount" },
                            sessions: { $sum: 1 },
                        },
                    }
                ])
            ]);

            // Combine both into a single chart format
            const combinedMap = new Map();
            
            chatData.forEach(item => {
                combinedMap.set(item._id, { 
                    date: item._id, 
                    chatRevenue: item.revenue, 
                    chatSessions: item.sessions,
                    callRevenue: 0,
                    callSessions: 0,
                    totalRevenue: item.revenue,
                    totalSessions: item.sessions
                });
            });

            callData.forEach(item => {
                const existing = combinedMap.get(item._id);
                if (existing) {
                    existing.callRevenue = item.revenue;
                    existing.callSessions = item.sessions;
                    existing.totalRevenue += item.revenue;
                    existing.totalSessions += item.sessions;
                } else {
                    combinedMap.set(item._id, {
                        date: item._id,
                        chatRevenue: 0,
                        chatSessions: 0,
                        callRevenue: item.revenue,
                        callSessions: item.sessions,
                        totalRevenue: item.revenue,
                        totalSessions: item.sessions
                    });
                }
            });

            const sortedData = Array.from(combinedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
            const filledChartData = this.fillDateGapsCombined(sortedData, start, end, timeRange);

            const totals = {
                chatRevenue: chatData.reduce((sum, i) => sum + i.revenue, 0),
                callRevenue: callData.reduce((sum, i) => sum + i.revenue, 0),
                totalRevenue: chatData.reduce((sum, i) => sum + i.revenue, 0) + callData.reduce((sum, i) => sum + i.revenue, 0),
                chatSessions: chatData.reduce((sum, i) => sum + i.sessions, 0),
                callSessions: callData.reduce((sum, i) => sum + i.sessions, 0),
                totalSessions: chatData.reduce((sum, i) => sum + i.sessions, 0) + callData.reduce((sum, i) => sum + i.sessions, 0),
            };

            return {
                success: true,
                data: {
                    chartData: filledChartData,
                    totals,
                    period: { start, end, timeRange },
                },
            };
        } catch (error) {
            this.logger.error(`Error getting AI revenue analytics: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    async getAITimeSlotAnalysis(): Promise<any> {
        try {
            const timeSlotData = await this.sessionModel.aggregate([
                {
                    $match: {
                        astrologerModel: 'AiAstrologerProfile',
                        status: { $in: ['active', 'ended'] },
                        startTime: { $exists: true },
                    },
                },
                {
                    $project: {
                        hour: { $hour: { date: '$startTime', timezone: 'Asia/Kolkata' } },
                        dayOfWeek: { $dayOfWeek: { date: '$startTime', timezone: 'Asia/Kolkata' } },
                        duration: 1,
                        totalAmount: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            hour: '$hour',
                            dayOfWeek: '$dayOfWeek',
                        },
                        sessionCount: { $sum: 1 },
                        avgDuration: { $avg: '$duration' },
                        totalRevenue: { $sum: '$totalAmount' },
                    },
                },
            ]);

            return { success: true, data: timeSlotData };
        } catch (error) {
            this.logger.error(`Error getting AI time slot analysis: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    async getAIAstrologerComparison(metric: string = 'revenue', limit: number = 10): Promise<any> {
        try {
            const profiles = await this.aiProfileModel.find().lean();

            const comparisonData = profiles.map(profile => {
                const totalSessions = (profile as any).totalSessions || 0;
                const viewCount = (profile as any).viewCount || totalSessions;

                // Conversion = (Total Successful Sessions / Total Profile Views)
                // We use Math.max(viewCount, totalSessions) to ensure conversion doesn't exceed 100%
                const conversionRate = viewCount > 0
                    ? (totalSessions / Math.max(viewCount, totalSessions)) * 100
                    : 0;

                return {
                    id: (profile as any)._id,
                    name: profile.name,
                    totalRevenue: (profile as any).totalRevenue || 0,
                    totalSessions: totalSessions,
                    rating: (profile as any).rating || 0,
                    satisfactionScore: (profile as any).satisfactionScore || 0,
                    avgSessionDuration: (profile as any).averageSessionDuration || 0,
                    conversionRate: parseFloat(conversionRate.toFixed(1))
                };
            });

            const sorted = this.sortByMetric(comparisonData, metric).slice(0, limit);

            return { success: true, data: sorted };
        } catch (error) {
            this.logger.error(`Error comparing AI astrologers: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    private sortByMetric(astrologers: any[], metric: string) {
        switch (metric) {
            case 'revenue':
                return astrologers.sort((a, b) => b.totalRevenue - a.totalRevenue);
            case 'sessions':
                return astrologers.sort((a, b) => b.totalSessions - a.totalSessions);
            case 'conversion':
                return astrologers.sort((a, b) => b.conversionRate - a.conversionRate);
            case 'satisfaction':
                return astrologers.sort((a, b) => b.satisfactionScore - a.satisfactionScore);
            case 'duration':
                return astrologers.sort((a, b) => b.avgSessionDuration - a.avgSessionDuration);
            default:
                return astrologers.sort((a, b) => b.totalRevenue - a.totalRevenue);
        }
    }

    // ===== 6. AUDIT & MODERATION =====

    async updateChatAuditStatus(id: string, status: string, notes?: string) {
        const filter = Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : { sessionId: id };
        const updated = await this.sessionModel.findOneAndUpdate(
            filter,
            { $set: { auditStatus: status, auditNotes: notes } },
            { new: true }
        );
        if (!updated) throw new NotFoundException('Chat session not found');
        return updated;
    }

    async updateCallAuditStatus(id: string, status: string, notes?: string) {
        const filter = Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : { sessionId: id };
        const updated = await this.callSessionModel.findOneAndUpdate(
            filter,
            { $set: { auditStatus: status, auditNotes: notes } },
            { new: true }
        );
        if (!updated) throw new NotFoundException('Call session not found');
        return updated;
    }
}
