import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CompatibilitySettings extends Document {
  // --- ZODIAC/LOVE SETTINGS ---
  // Overrides for pair insights (e.g. key "0-6")
  @Prop({ type: Object, default: {} })
  pairInsights: Record<string, { 
    insight: string; 
    chemistry: string; 
    daily: string; 
    score?: number;
    categoryScores?: {
      emotional: number; intellectual: number; physical: number;
      spiritual: number; communication: number; romance: number;
      longTerm: number;
    };
    strengths?: string[]; 
    challenges?: string[]; 
    advice?: string 
  }>;

  // Overrides for element combination insights (e.g. "Fire-Air")
  @Prop({ type: Object, default: {} })
  elementInsights: Record<string, { 
    insight: string; 
    chemistry: string; 
    daily: string; 
    score?: number;
    categoryScores?: {
      emotional: number; intellectual: number; physical: number;
      spiritual: number; communication: number; romance: number;
      longTerm: number;
    };
    strengths?: string[]; 
    challenges?: string[]; 
    advice?: string 
  }>;

  // --- NUMEROLOGY/NAME SETTINGS ---
  // Overrides for number archetypes (1-9, 11, 22)
  @Prop({ type: Object, default: {} })
  archetypes: Record<string, { title: string; planet: string; traits: string[]; description: string; inLove: string }>;

  // Overrides for numerology pair insights
  @Prop({ type: Object, default: {} })
  numerologyPairInsights: Record<string, string>;

  // Overrides for specific numerology scores (e.g. key "1-1")
  @Prop({ type: Object, default: {} })
  numerologyScores: Record<string, number>;

  // Overrides for numerology challenges
  @Prop({ type: Object, default: {} })
  numerologyChallenges: Record<string, string>;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const CompatibilitySettingsSchema = SchemaFactory.createForClass(CompatibilitySettings);
