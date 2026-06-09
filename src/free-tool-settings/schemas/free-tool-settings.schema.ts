import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class FreeToolSettings extends Document {
  // --- KAAL SARP SETTINGS ---
  @Prop({ type: Object, default: {} })
  kaalSarp: Record<string, {
    meaning: string;
    description: string;
    effects: string[];
    remedies: string[];
    resultMsg?: string;
    intro?: string;
  }>;

  // --- SADE SATI SETTINGS ---
  @Prop({ type: Object, default: {} })
  sadeSati: Record<string, {
    description: string;
    effects: string[];
    remedies: string[];
    intro?: string;
    resultMsg?: string;
  }>;

  @Prop({ type: Object, default: {} })
  gemstones: Record<string, {
    profile: string;
    benefits: string[];
    wearingInstructions: string;
    hindiName: string;
    weight: string;
    mantra: string;
    day: string;
    substitute: string;
    intro?: string;
    resultMsg?: string;
  }>;

  @Prop({ type: Object, default: {} })
  gemstoneRoleDescriptions: Record<string, string>;

  @Prop({ default: '' })
  kaalSarpIntro: string;

  @Prop({ default: '' })
  sadeSatiIntro: string;

  @Prop({ default: '' })
  gemstonesIntro: string;

  @Prop({ default: 'Result: Your Horoscope is afflicted with {type}' })
  kaalSarpResultMsg: string;

  @Prop({ default: 'No Kaal Sarp Yoga Found' })
  kaalSarpNoDoshaMsg: string;

  @Prop({ default: 'Result: You are currently in {phase} of Sade Sati' })
  sadeSatiResultMsg: string;

  @Prop({ default: 'Recommended Gemstone for you is {gemstone}' })
  gemstonesResultMsg: string;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const FreeToolSettingsSchema = SchemaFactory.createForClass(FreeToolSettings);
