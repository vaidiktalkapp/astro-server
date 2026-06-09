import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageFeedbackDocument = ChatMessageFeedback & Document;

@Schema({ timestamps: true, collection: 'chat_message_feedback' })
export class ChatMessageFeedback {
  @Prop({ required: true, enum: ['thumbs_up', 'thumbs_down'] })
  type: string;

  @Prop({ required: true })
  messageId: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, refPath: 'astrologerModel' })
  astrologerId?: Types.ObjectId;

  @Prop({ enum: ['Astrologer', 'AiAstrologerProfile'], default: 'Astrologer' })
  astrologerModel: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const ChatMessageFeedbackSchema = SchemaFactory.createForClass(ChatMessageFeedback);

// Indexes for analytics
ChatMessageFeedbackSchema.index({ type: 1, astrologerId: 1 });
ChatMessageFeedbackSchema.index({ sessionId: 1 });
ChatMessageFeedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true }); // One feedback per user per message
