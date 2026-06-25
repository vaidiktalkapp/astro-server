import { Controller, Post, Body, Req, UseGuards, Get, Param, NotFoundException, Patch, Query } from '@nestjs/common';
import { AiChatSessionService } from '../services/chat-session.service';
import { AiAstrologyEngineService } from '../services/ai-astrology-engine.service';
import { AiAnalyticsService } from '../services/ai-analytics.service';
import { RatingReviewService } from '../../astrologers/services/rating-review.service';
import { StartAiChatDto } from '../dto/start-ai-chat.dto';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';
import { UpdatePersonalityDto, PERSONALITY_PRESETS } from '../dto/update-personality.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../schemas/ai-astrologers-profile.schema';
import { User } from '../../users/schemas/user.schema';
import { SystemSettings } from '../../payments/schemas/system-settings.schema';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';

@Controller('ai-astrologers')
export class AiAstrologersController {
    constructor(
        private readonly chatSessionService: AiChatSessionService,
        private readonly aiEngineService: AiAstrologyEngineService,
        private readonly analyticsService: AiAnalyticsService,
        private readonly ratingReviewService: RatingReviewService,
        @InjectModel(AiAstrologerProfile.name) private aiProfileModel: Model<AiAstrologerProfileDocument>,
        @InjectModel(User.name) private userModel: Model<any>,
        @InjectModel(SystemSettings.name) private systemSettingsModel: Model<any>,
    ) { }

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    async listAll(@Req() req: any) {
        const profiles = await this.aiProfileModel.find({ isAvailable: true }).select('-systemPromptAddition').lean();
        let isEligibleForFreeAi = false;
        let freeDurationMinutes = 1;

        const settings = await this.systemSettingsModel.findOne();
        const isFreeEnabled = settings ? (settings.isAiFirstCallFreeEnabled ?? false) : false;
        if (isFreeEnabled) {
            freeDurationMinutes = settings ? (settings.aiFirstCallFreeDurationMinutes ?? 1) : 1;
            if (req.user && req.user.userId) {
                const user = await this.userModel.findById(req.user.userId);
                if (user && !user.isAiFirstConsultationUsed) {
                    isEligibleForFreeAi = true;
                }
            } else {
                isEligibleForFreeAi = true;
            }
        }

        return {
            success: true,
            data: profiles.map(p => this.mapProfile(p, isEligibleForFreeAi, freeDurationMinutes))
        };
    }

    @Get(':id')
    @UseGuards(OptionalJwtAuthGuard)
    async getDetail(@Param() params: any, @Req() req: any) {
        const id = typeof params === 'object' ? params.id : params;

        if (typeof id !== 'string' || !id || id === '[object Object]') {
            throw new NotFoundException(`Invalid astrologer ID format: ${id}`);
        }

        const profileDoc = await this.aiProfileModel.findById(id).select('-systemPromptAddition');
        if (!profileDoc) throw new NotFoundException('AI Astrologer not found');

        profileDoc.viewCount = (profileDoc.viewCount || 0) + 1;
        await profileDoc.save();

        const profile = profileDoc.toObject();

        await this.ratingReviewService.seedTestReviewsIfEmpty(id);
        const reviewsData = await this.ratingReviewService.getAstrologerReviews(id, 1, 500);

        let isEligibleForFreeAi = false;
        let freeDurationMinutes = 1;

        const settings = await this.systemSettingsModel.findOne();
        const isFreeEnabled = settings ? (settings.isAiFirstCallFreeEnabled ?? false) : false;
        if (isFreeEnabled) {
            freeDurationMinutes = settings ? (settings.aiFirstCallFreeDurationMinutes ?? 1) : 1;
            if (req.user && req.user.userId) {
                const user = await this.userModel.findById(req.user.userId);
                if (user && !user.isAiFirstConsultationUsed) {
                    isEligibleForFreeAi = true;
                }
            } else {
                isEligibleForFreeAi = true;
            }
        }

        return {
            success: true,
            data: this.mapProfile(profile, isEligibleForFreeAi, freeDurationMinutes),
            reviews: reviewsData.reviews,
            reviewsPagination: reviewsData.pagination,
        };
    }

    private mapProfile(profile: any, isEligibleForFreeAi: boolean = false, freeDurationMinutes: number = 1) {
        if (!profile) return null;
        const obj = profile.toObject ? profile.toObject() : profile;

        const totalRevenue = obj.totalRevenue || 0;
        const platformCommissionRate = 0;
        const platformCommission = 0;
        const netEarnings = totalRevenue;

        const chatRate = isEligibleForFreeAi ? 0 : (obj.chatRatePerMinute ?? obj.ratePerMinute ?? 0);
        const callRate = isEligibleForFreeAi ? 0 : (obj.callRatePerMinute ?? obj.ratePerMinute ?? 0);

        return {
            _id: obj._id?.toString(),
            id: obj._id?.toString(),
            name: obj.name,
            gender: obj.gender || 'male',
            bio: obj.bio,
            profilePicture: obj.image,
            profileImage: obj.image,
            experienceYears: obj.experience || 0,
            specializations: obj.specialization || [],
            specialization: obj.specialization || [],
            expertise: obj.expertise,
            languages: obj.languages || ['English'],
            country: obj.country || 'India',
            tier: obj.tier || 'rising_star',
            isChatEnabled: obj.isChatEnabled ?? true,
            isCallEnabled: obj.isCallEnabled ?? true,
            chatRatePerMinute: chatRate,
            callRatePerMinute: callRate,
            chatRate: chatRate,
            voiceRate: callRate,
            rate: chatRate,
            isAiPromotional: isEligibleForFreeAi,
            promotionalDurationMinutes: freeDurationMinutes,
            pricing: {
                chat: chatRate,
                call: callRate,
                videoCall: 0,
                originalChatRate: obj.chatRatePerMinute ?? obj.ratePerMinute ?? 0,
                originalCallRate: obj.callRatePerMinute ?? obj.ratePerMinute ?? 0,
            },
            ratings: {
                average: obj.rating || obj.satisfactionScore || 4.5,
                total: obj.totalSessions || 0
            },
            stats: {
                totalOrders: obj.totalSessions || 0,
                totalEarnings: totalRevenue,
                totalGifts: 0
            },
            availability: {
                isOnline: obj.isAvailable || false,
                isAvailable: obj.isAvailable || false,
                isLive: false
            },
            focusArea: obj.focusArea,
            tone: obj.tone,
            accountStatus: obj.accountStatus || (obj.isAvailable ? 'active' : 'inactive'),
            profileCompletion: {
                isComplete: true
            },
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            earnings: {
                lastUpdated: obj.updatedAt || new Date(),
                netEarnings: netEarnings,
                platformCommission: platformCommission,
                totalEarned: totalRevenue,
                withdrawableAmount: netEarnings,
                totalGiftEarnings: 0
            }
        };
    }

    @Post('chat/start')
    @UseGuards(JwtAuthGuard)
    async startChat(@Body() dto: StartAiChatDto, @Req() req: any) {
        const userId = req.user?.userId || '65a000000000000000000000';

        // Fetch AI Profile for tone/style
        const aiProfile = await this.aiProfileModel.findById(dto.astrologerId);
        if (!aiProfile) {
            throw new NotFoundException('AI Astrologer not found');
        }

        const session = await this.chatSessionService.startSession(userId, dto);

        const profileData = {
            name: dto.userName,
            dateOfBirth: dto.dateOfBirth,
            timeOfBirth: dto.timeOfBirth,
            placeOfBirth: dto.placeOfBirth,
            tone: aiProfile.tone,
            styleGuide: aiProfile.styleGuide,
            personalityType: aiProfile.personalityType,
            systemPromptAddition: aiProfile.systemPromptAddition,
            expertise: aiProfile.expertise // Pass expertise to engine
        };

        // Initial greeting is now triggered via Socket when the frontend sends "Below are my details:"
        return {
            session,
            initialResponse: null,
            greeting: null
        };
    }

    @Post('chat/message')
    @UseGuards(JwtAuthGuard)
    async sendMessage(@Body() dto: SendAiMessageDto, @Req() req: any) {
        const userId = req.user?.userId || '65a000000000000000000000';

        const { session: updatedSession } = await this.chatSessionService.saveMessage(dto.sessionId, dto.message, 'user', userId);
        const session = updatedSession;
        if (!session) {
            throw new NotFoundException('Session not found');
        }

        // Fetch AI Profile
        const aiProfile = await this.aiProfileModel.findById(session.astrologerId);

        // Prepare User Birth Details
        const userBirthDetails = {
            name: "User",
            dateOfBirth: session.userBirthChart?.dateOfBirth || "2000-01-01",
            timeOfBirth: session.userBirthChart?.timeOfBirth || "12:00",
            placeOfBirth: session.userBirthChart?.placeOfBirth || "India",
        };

        // Prepare Astrologer Profile
        const astrologerProfile = {
            name: aiProfile?.name || 'Astrologer',
            tone: aiProfile?.tone,
            styleGuide: aiProfile?.styleGuide,
            personalityType: aiProfile?.personalityType,
            systemPromptAddition: aiProfile?.systemPromptAddition,
            expertise: aiProfile?.expertise,
            bio: aiProfile?.bio,
            focusArea: aiProfile?.focusArea
        };

        // Fetch History
        const history = await this.chatSessionService.getRecentMessages(dto.sessionId, 10);
        const language = session.language || 'English';

        const aiResponse = await this.aiEngineService.generateResponse(
            dto.message,
            astrologerProfile,
            userBirthDetails,
            history,
            language
        );
        const followUps = await this.aiEngineService.suggestFollowUps(history, astrologerProfile, userBirthDetails, language);

        await this.chatSessionService.saveMessage(dto.sessionId, aiResponse, 'astrologer', String(session.astrologerId));


        return {
            reply: aiResponse,
            suggestedQuestions: followUps
        };
    }

    // ==================== PERSONALITY MANAGEMENT ====================

    @Get('personality-presets')
    getPersonalityPresets() {
        return {
            success: true,
            data: PERSONALITY_PRESETS,
        };
    }

    @Patch(':id/personality')
    async updatePersonality(@Param('id') id: string, @Body() dto: UpdatePersonalityDto) {
        const profile = await this.aiProfileModel.findById(id);
        if (!profile) {
            throw new NotFoundException('AI Astrologer not found');
        }

        // Apply preset if specified
        if (dto.personalityPreset && dto.personalityPreset !== 'custom') {
            const preset = PERSONALITY_PRESETS.find(p => p.id === dto.personalityPreset);
            if (preset) {
                profile.personalityPreset = preset.id;
                profile.personalityType = preset.personalityType;
                profile.tone = preset.tone;
                profile.styleGuide = preset.styleGuide;
                profile.personalityDescription = preset.description;
                if (!profile.aiModelParams) {
                    profile.aiModelParams = {
                        temperature: preset.temperature,
                        topP: preset.topP,
                        maxOutputTokens: preset.maxOutputTokens,
                    };
                } else {
                    profile.aiModelParams.temperature = preset.temperature;
                    profile.aiModelParams.topP = preset.topP;
                    profile.aiModelParams.maxOutputTokens = preset.maxOutputTokens;
                }
            }
        }

        // Apply custom overrides
        if (dto.personalityType) profile.personalityType = dto.personalityType;
        if (dto.tone) profile.tone = dto.tone;
        if (dto.styleGuide) profile.styleGuide = dto.styleGuide;
        if (dto.personalityDescription) profile.personalityDescription = dto.personalityDescription;
        if (dto.systemPromptAddition !== undefined) profile.systemPromptAddition = dto.systemPromptAddition;

        if (dto.aiModelParams) {
            if (!profile.aiModelParams) {
                profile.aiModelParams = {
                    temperature: 0.7,
                    topP: 0.9,
                    maxOutputTokens: 1024,
                };
            }
            if (dto.aiModelParams.temperature !== undefined) {
                profile.aiModelParams.temperature = dto.aiModelParams.temperature;
            }
            if (dto.aiModelParams.topP !== undefined) {
                profile.aiModelParams.topP = dto.aiModelParams.topP;
            }
            if (dto.aiModelParams.maxOutputTokens !== undefined) {
                profile.aiModelParams.maxOutputTokens = dto.aiModelParams.maxOutputTokens;
            }
        }

        await profile.save();

        return {
            success: true,
            data: profile,
            message: 'Personality updated successfully',
        };
    }

    // ==================== ANALYTICS ====================

    @Get('analytics/revenue')
    async getRevenueAnalytics(
        @Query('timeRange') timeRange: string = 'monthly',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.analyticsService.getRevenueAnalytics(timeRange, startDate, endDate);
    }

    @Get('analytics/time-slots')
    async getTimeSlotAnalysis() {
        return this.analyticsService.getTimeSlotAnalysis();
    }

    @Get('analytics/comparison')
    async getAstrologerComparison(
        @Query('metric') metric: string = 'revenue',
        @Query('limit') limit: string = '10',
    ) {
        return this.analyticsService.getAstrologerComparison(metric, parseInt(limit, 10));
    }

    @Get('analytics/conversion-metrics')
    async getConversionMetrics() {
        return this.analyticsService.getConversionMetrics();
    }
}
