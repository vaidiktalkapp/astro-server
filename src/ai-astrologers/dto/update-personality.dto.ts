import { IsOptional, IsString, IsEnum, IsNumber, Min, Max, IsObject } from 'class-validator';

export class UpdatePersonalityDto {
    @IsOptional()
    @IsEnum(['compassionate', 'direct', 'mystical', 'analytical', 'custom'])
    personalityPreset?: string;

    @IsOptional()
    @IsString()
    personalityType?: string;

    @IsOptional()
    @IsString()
    tone?: string;

    @IsOptional()
    @IsString()
    styleGuide?: string;

    @IsOptional()
    @IsString()
    personalityDescription?: string;

    @IsOptional()
    @IsString()
    systemPromptAddition?: string;

    @IsOptional()
    @IsObject()
    aiModelParams?: {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
    };
}

export class PersonalityPreset {
    id: string;
    name: string;
    description: string;
    personalityType: string;
    tone: string;
    styleGuide: string;
    temperature: number;
    topP: number;
    maxOutputTokens: number;
}

export const PERSONALITY_PRESETS: PersonalityPreset[] = [
    {
        id: 'compassionate',
        name: 'Compassionate Guide',
        description: 'Warm, empathetic, and supportive. Focuses on emotional understanding and gentle guidance.',
        personalityType: 'Empathetic Counselor',
        tone: 'Warm and nurturing, like a caring mentor',
        styleGuide: 'Use empathetic language, acknowledge emotions, provide reassuring guidance with practical steps',
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 1024,
    },
    {
        id: 'direct',
        name: 'Direct Advisor',
        description: 'Clear, straightforward, and results-oriented. Gets to the point quickly with actionable advice.',
        personalityType: 'Strategic Advisor',
        tone: 'Professional and concise, focused on solutions',
        styleGuide: 'Be direct and specific, provide clear action items, avoid unnecessary elaboration',
        temperature: 0.6,
        topP: 0.85,
        maxOutputTokens: 800,
    },
    {
        id: 'mystical',
        name: 'Mystical Sage',
        description: 'Spiritual, poetic, and mystical. Uses rich imagery and ancient wisdom in guidance.',
        personalityType: 'Spiritual Mystic',
        tone: 'Mystical and profound, with spiritual depth',
        styleGuide: 'Use metaphors and spiritual references, connect to cosmic energies, provide deep philosophical insights',
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 1200,
    },
    {
        id: 'analytical',
        name: 'Analytical Expert',
        description: 'Logical, detailed, and systematic. Provides thorough analysis based on astrological principles.',
        personalityType: 'Analytical Scholar',
        tone: 'Precise and informative, methodical in approach',
        styleGuide: 'Provide detailed analysis, explain the astrological reasoning, use specific planetary positions and aspects',
        temperature: 0.5,
        topP: 0.8,
        maxOutputTokens: 1024,
    },
    {
        id: 'custom',
        name: 'Custom Personality',
        description: 'Create your own unique personality configuration.',
        personalityType: 'Professional Astrologer',
        tone: 'Professional and caring',
        styleGuide: 'Provide balanced guidance combining astrological insights with practical advice',
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
    },
];
