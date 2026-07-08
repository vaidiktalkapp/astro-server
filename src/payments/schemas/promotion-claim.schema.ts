import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PromotionClaimDocument = PromotionClaim & Document;

@Schema({ timestamps: true })
export class PromotionClaim {
  @Prop({ required: true, index: true })
  phoneHash: string;

  @Prop({ required: true, index: true })
  promotionType: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId; // Optional reference to the user who claimed it
}

export const PromotionClaimSchema = SchemaFactory.createForClass(PromotionClaim);

// Prevent same phoneHash from claiming same promotionType multiple times
PromotionClaimSchema.index({ phoneHash: 1, promotionType: 1 }, { unique: true });
