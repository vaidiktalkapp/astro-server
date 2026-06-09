// src/chat/schemas/chat-session.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

@Schema({ timestamps: true, collection: 'chat_sessions' })
export class ChatSession {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, refPath: 'astrologerModel' })
  astrologerId: Types.ObjectId;

  @Prop({ default: 'Astrologer' })
  astrologerModel: string; // 'Astrologer' or 'AiAstrologerProfile'

  @Prop({ required: true })
  orderId: string;

  // ✅ NEW: Link to conversation thread
  @Prop()
  conversationThreadId?: string; // Same as order.conversationThreadId

  // ✅ NEW: Session sequence number (1st chat, 2nd chat, etc.)
  @Prop({ default: 1 })
  sessionNumber: number;

  // ===== STATUS FLOW =====
  @Prop({
    required: true,
    enum: ['initiated', 'ringing', 'waiting', 'waiting_in_queue', 'active', 'ended', 'cancelled', 'rejected'],
    default: 'initiated',
  })
  status: string;

  // ===== TIMING =====
  @Prop()
  requestCreatedAt: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  ringTime?: Date;

  @Prop()
  startTime?: Date;

  @Prop()
  endTime?: Date;

  @Prop({ default: 0 })
  maxDurationMinutes: number;

  @Prop({ default: 0 })
  maxDurationSeconds: number;

  @Prop({ default: 0 })
  duration: number;

  @Prop({ default: 0 })
  billedMinutes: number;

  // ===== RATE & PRICING =====
  @Prop({ required: true })
  ratePerMinute: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ default: 0 })
  totalCost: number; // For backward compatibility/unified analytics

  @Prop({ default: 0 })
  platformCommission: number;

  @Prop({ default: 0 })
  astrologerEarning: number;

  @Prop()
  postSessionWindowEndsAt?: Date;

  @Prop({ default: false })
  isPaid: boolean;

  @Prop()
  paidAt?: Date;

  // ===== FREE CHAT =====
  // ===== TIMER STATE =====
  @Prop({
    enum: ['not_started', 'running', 'paused', 'ended'],
    default: 'not_started'
  })
  timerStatus: string;

  @Prop({
    type: {
      elapsedSeconds: { type: Number, default: 0 },
      remainingSeconds: { type: Number, default: 0 },
      lastUpdatedAt: Date,
      warningShownAt1Min: { type: Boolean, default: false }
    }
  })
  timerMetrics: {
    elapsedSeconds: number;
    remainingSeconds: number;
    lastUpdatedAt?: Date;
    warningShownAt1Min?: boolean;
  };

  // ===== MESSAGE TRACKING =====
  @Prop({ default: 0 })
  messageCount: number;

  @Prop()
  lastMessageAt?: Date;

  @Prop({
    type: {
      content: String,
      type: String,
      sentBy: String,
      sentAt: Date
    }
  })
  lastMessage?: {
    content: string;
    type: string;
    sentBy: string;
    sentAt: Date;
  };

  // ===== ONLINE STATUS =====
  @Prop({
    type: {
      userId: { type: Types.ObjectId },
      isOnline: { type: Boolean, default: false },
      lastSeen: Date
    }
  })
  userStatus?: {
    userId: Types.ObjectId;
    isOnline: boolean;
    lastSeen?: Date;
  };

  @Prop({
    type: {
      astrologerId: { type: Types.ObjectId },
      isOnline: { type: Boolean, default: false },
      lastSeen: Date
    }
  })
  astrologerStatus?: {
    astrologerId: Types.ObjectId;
    isOnline: boolean;
    lastSeen?: Date;
  };

  @Prop()
  previousSessionId?: string; // Link to previous session for continuation

  // ===== QUEUE INFO =====
  @Prop()
  expectedWaitTime?: number;

  @Prop()
  estimatedStartTime?: Date;

  @Prop()
  queuePosition?: number;

  // ===== END DETAILS =====
  @Prop()
  endedBy?: string;

  @Prop()
  endReason?: string;

  @Prop({ min: 1, max: 5 })
  userSatisfactionRating?: number;

  @Prop({ default: false })
  reviewGiven: boolean;

  @Prop()
  reviewGivenAt?: Date;

  // ===== METADATA =====
  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // ===== AI SPECIFIC =====
  @Prop({ default: 0 })
  avgLatency?: number;

  @Prop({ default: 0 })
  avgAccuracy?: number;

  @Prop({ type: Object })
  userBirthChart?: {
    name: string;
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
    query?: string;
  };

  // ===== MULTIPLE PROFILES OVERRIDE =====
  @Prop({ type: Object })
  intakeProfile?: {
    name: string;
    gender: string;
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
    lat?: string;
    lon?: string;
    maritalStatus?: string;
    occupation?: string;
    relation?: string;
  };

  @Prop({ default: 'English' })
  language?: string;

  @Prop({ default: false })
  isGreetingGenerated?: boolean;

  // ===== AUDIT =====
  @Prop({ enum: ['pending', 'approved', 'flagged'], default: 'pending' })
  auditStatus: string;

  @Prop()
  auditNotes?: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

// Indexes
// Unique index for sessionId is created via @Prop({ unique: true })
ChatSessionSchema.index({ userId: 1, createdAt: -1 });
ChatSessionSchema.index({ astrologerId: 1, createdAt: -1 });
ChatSessionSchema.index({ conversationThreadId: 1 }, { sparse: true });
ChatSessionSchema.index({ orderId: 1 });
ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ astrologerId: 1, status: 1 });
