import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AbuseReportDocument = AbuseReport & Document;

@Schema({ timestamps: true })
export class AbuseReport {
  @Prop({ type: String, required: true })
  reportId: string; // e.g., RPT-123456

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId; // Who submitted the report (User or Astrologer)

  @Prop({ type: String, enum: ['User', 'Astrologer'], required: true })
  reporterModel: string;

  @Prop({ type: Types.ObjectId, required: true })
  reportedEntityId: Types.ObjectId; // The User/Astrologer being reported

  @Prop({ type: String, required: true }) // 'chat', 'livestream', 'profile', etc.
  entityType: string;

  @Prop({ type: String }) // Specific Chat Room ID or Stream ID
  contextId: string;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' })
  status: string;

  @Prop({ type: String })
  adminNotes: string;
}

export const AbuseReportSchema = SchemaFactory.createForClass(AbuseReport);