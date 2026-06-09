import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class LoveHoroscopeCache extends Document {
  @Prop({ required: true, index: true })
  sign: string;

  @Prop({ required: true, index: true })
  period: string;

  @Prop({ required: true, index: true })
  targetDate: string;

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

export const LoveHoroscopeCacheSchema = SchemaFactory.createForClass(LoveHoroscopeCache);

LoveHoroscopeCacheSchema.index({ sign: 1, period: 1, targetDate: 1 }, { unique: true });
