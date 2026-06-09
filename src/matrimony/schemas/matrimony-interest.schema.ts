import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatrimonyInterestDocument = MatrimonyInterest & Document;

@Schema({
  timestamps: true,
  collection: 'matrimony_interests',
})
export class MatrimonyInterest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'accepted' | 'rejected';
}

export const MatrimonyInterestSchema = SchemaFactory.createForClass(MatrimonyInterest);

// Indexes for fast lookups
MatrimonyInterestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
MatrimonyInterestSchema.index({ receiverId: 1, status: 1 });
