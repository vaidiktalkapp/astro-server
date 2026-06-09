import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class LalKitabSettings extends Document {
  // --- PLANET OVERRIDES ---
  // Key format: "Planet-House" (e.g., "Sun-1", "Jupiter-4")
  @Prop({ type: Object, default: {} })
  planetOverrides: Record<string, {
    analysis: string;
    beneficEffects: string[];
    maleficEffects: string[];
    remedies: string[];
    houseGuide: string[];
  }>;

  // --- GLOBAL REMEDIES ---
  @Prop({ type: [{ category: String, text: String, icon: String }], default: [] })
  lifeAreaRemedies: { category: string; text: string; icon: string }[];

  // --- GENERAL RULES ---
  @Prop({ type: [String], default: [] })
  generalRules: string[];

  // --- AI CONFIGURATION ---
  @Prop({
    type: {
      general: String,
      specific: String
    },
    default: {
      general: '',
      specific: ''
    }
  })
  systemPrompts: {
    general: string;
    specific: string;
  };

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const LalKitabSettingsSchema = SchemaFactory.createForClass(LalKitabSettings);
