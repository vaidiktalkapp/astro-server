import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AstrologyHistoryDocument = AstrologyHistory & Document;

@Schema({ timestamps: true, collection: 'astrology_histories' })
export class AstrologyHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  featureType: string;

  @Prop({ type: Object, required: true })
  data: any;
}

export const AstrologyHistorySchema = SchemaFactory.createForClass(AstrologyHistory);

// Compound index for quick fetching per user per feature
AstrologyHistorySchema.index({ userId: 1, featureType: 1 });
