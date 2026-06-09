import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class LoveHoroscope extends Document {
  @Prop({ required: true, index: true })
  sign: string;

  @Prop({ required: true, index: true, enum: ['daily', 'weekly'] })
  period: string;

  @Prop({ required: true, index: true })
  targetDate: string; // YYYY-MM-DD for daily, or YYYY-WW for weekly

  @Prop({ required: true })
  prediction: string;

  @Prop({ required: true })
  loveScore: number;

  @Prop({ required: true })
  vibeName: string;

  @Prop({ required: true })
  forCouples: string;

  @Prop({ required: true })
  forSingles: string;

  @Prop({ required: true })
  relationshipAdvice: string;

  @Prop()
  luckyColor: string;

  @Prop()
  luckyNumber: string;

  @Prop()
  luckyTime: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const LoveHoroscopeSchema = SchemaFactory.createForClass(LoveHoroscope);

// Ensure unique index for sign, period, and date combination
LoveHoroscopeSchema.index({ sign: 1, period: 1, targetDate: 1 }, { unique: true });
