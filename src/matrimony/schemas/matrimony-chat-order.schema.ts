import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatrimonyChatOrderDocument = MatrimonyChatOrder & Document;

@Schema({ timestamps: true, collection: 'matrimony_chat_orders' })
export class MatrimonyChatOrder {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'MatrimonyInterest' })
  interestId: Types.ObjectId; 

  @Prop({ required: true })
  totalMessages: number;

  @Prop({ default: 0 })
  messagesUsed: number;

  @Prop({ required: true })
  amountPaid: number;

  @Prop({ default: 'active', enum: ['active', 'exhausted', 'refunded'] })
  status: string;
}

export const MatrimonyChatOrderSchema = SchemaFactory.createForClass(MatrimonyChatOrder);

MatrimonyChatOrderSchema.index({ userId: 1, interestId: 1, status: 1 });
