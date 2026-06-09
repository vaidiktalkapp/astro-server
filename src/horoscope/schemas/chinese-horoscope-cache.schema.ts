import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChineseHoroscopeCache extends Document {
  @Prop({ required: true, index: true })
  sign: string;

  @Prop({ required: true, index: true })
  period: string;

  @Prop({ required: true, index: true })
  targetDate: string;

  @Prop({ required: true })
  prediction: string;

  @Prop({ required: true })
  luckyColor: string;

  @Prop({ required: true })
  luckyNumber: string;

  @Prop({ required: true })
  luckyTime: string;

  @Prop({ required: true })
  vibeName: string;

  @Prop({ required: true })
  vibeScore: number;

  @Prop({ required: true })
  forRelationships: string;

  @Prop({ required: true })
  forSingles: string;

  @Prop({ required: true })
  careerInsight: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ChineseHoroscopeCacheSchema = SchemaFactory.createForClass(ChineseHoroscopeCache);

ChineseHoroscopeCacheSchema.index({ sign: 1, period: 1, targetDate: 1 }, { unique: true });
