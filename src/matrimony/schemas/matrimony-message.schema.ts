import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatrimonyMessageDocument = MatrimonyMessage & Document;

@Schema({ timestamps: true, collection: 'matrimony_messages' })
export class MatrimonyMessage {
  @Prop({ required: true, type: Types.ObjectId, ref: 'MatrimonyInterest' })
  interestId: Types.ObjectId; // Serves as the Match ID / Room ID

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  receiverId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'sent', enum: ['sent', 'delivered', 'read'] })
  status: string;

  @Prop({ default: Date.now })
  sentAt: Date;
}

export const MatrimonyMessageSchema = SchemaFactory.createForClass(MatrimonyMessage);

// Index on interestId to quickly fetch all messages for a specific chat room
MatrimonyMessageSchema.index({ interestId: 1, sentAt: 1 });
