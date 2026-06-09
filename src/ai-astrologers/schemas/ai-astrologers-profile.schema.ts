import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiAstrologerProfileDocument = AiAstrologerProfile & Document;

@Schema({ timestamps: true, collection: 'ai_astrologer_profiles' })
export class AiAstrologerProfile {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ default: '/uploads/default-astrologer.png' })
    image: string;

    @Prop({ required: true })
    bio: string;

    @Prop({ default: 5 })
    experience: number;

    @Prop({ enum: ['male', 'female', 'other'], default: 'male' })
    gender: string;

    @Prop({ default: 'India' })
    country: string;

    @Prop({ enum: ['none', 'rising_star', 'top_choice', 'celebrity'], default: 'none' })
    tier: string;

    @Prop({ default: 'Certified Astrologer' })
    education: string;


    @Prop({ default: 'Love, Career, Relationship' })
    focusArea: string;

    @Prop({ required: true, enum: ['Vedic', 'Tarot', 'Numerology', 'LalKitab'], default: 'Vedic' })
    expertise: string;

    @Prop({ enum: ['vapi', 'gemini'], default: 'vapi' })
    voiceProvider: string;

    @Prop({ type: [String] })
    specialization: string[];

    @Prop({ enum: ['compassionate', 'direct', 'mystical', 'analytical', 'custom'], default: 'custom' })
    personalityPreset: string;

    @Prop({ required: true })
    personalityType: string;

    @Prop({ default: 'Custom AI astrologer personality' })
    personalityDescription: string;

    @Prop({ default: 'Professional and caring' })
    tone: string;

    @Prop({ default: 'Provide detailed explanations with practical advice' })
    styleGuide: string;

    @Prop({ default: '' })
    systemPromptAddition: string;

    @Prop({ required: true, min: 0 })
    ratePerMinute: number;

    @Prop({ default: true })
    isChatEnabled: boolean;

    @Prop({ default: true })
    isCallEnabled: boolean;

    @Prop({ default: 0 })
    chatRatePerMinute: number;

    @Prop({ default: 0 })
    callRatePerMinute: number;

    @Prop({ default: 'pMSpe79Vf0vVp3n37rV6' }) // Default Indian/Neutral voice
    voiceId: string;

    @Prop({ type: [String], default: ['English'] })
    languages: string[];

    @Prop({ default: true })
    isAvailable: boolean;

    @Prop({ default: true })
    isAI: boolean;

    @Prop({ enum: ['active', 'inactive', 'suspended'], default: 'active' })
    status: string;

    @Prop({ enum: ['active', 'inactive', 'suspended'], default: 'active' })
    accountStatus: string;

    @Prop({ trim: true, default: 'Ancient Wisdom for Modern Times' })
    tagline: string;

    @Prop({ default: '#FF9933' })
    profileColor: string;

    @Prop({
        type: [String], default: [
            'What does my career path look like this year?',
            'When will I find a compatible life partner?',
            'How can I improve my financial stability?'
        ]
    })
    sampleQueries: string[];

    @Prop({
        type: {
            temperature: { type: Number, default: 0.7 },
            topP: { type: Number, default: 0.9 },
            maxOutputTokens: { type: Number, default: 1024 }
        }
    })
    aiModelParams: {
        temperature: number;
        topP: number;
        maxOutputTokens: number;
    };

    @Prop({ default: false })
    isPromoted: boolean;

    @Prop({ default: 4.5, min: 0, max: 5 })
    rating: number;

    @Prop({ default: 0 })
    totalSessions: number;

    @Prop({ default: 0 })
    totalRevenue: number;

    @Prop({ default: 0 })
    averageSessionDuration: number;

    @Prop({ default: 0 })
    averageLatency: number; // In seconds

    @Prop({ default: 85 })
    averageAccuracy: number; // 0-100 percentage (default 85% for new AI astrologers)

    @Prop({ default: 4.5, min: 0, max: 5 })
    satisfactionScore: number;

    @Prop({ default: 0 })
    viewCount: number;

    @Prop({ default: 0, min: 0, max: 100 })
    conversionRate: number;

    @Prop({
        type: {
            daily: { type: Number, default: 0 },
            weekly: { type: Number, default: 0 },
            monthly: { type: Number, default: 0 },
            yearly: { type: Number, default: 0 },
        },
        default: { daily: 0, weekly: 0, monthly: 0, yearly: 0 }
    })
    revenueBreakdown: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
}

export const AiAstrologerProfileSchema = SchemaFactory.createForClass(AiAstrologerProfile);
