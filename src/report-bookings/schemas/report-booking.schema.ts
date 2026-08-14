import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportBookingDocument = ReportBooking & Document;

@Schema({ timestamps: true, collection: 'report_bookings' })
export class ReportBooking {
  @Prop({ required: true, unique: true })
  bookingId: string; // e.g. REP-123456789

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  reportName: string; // e.g. Vaidik Smart Kundali 10 Years

  @Prop({ required: true })
  reportSlug: string;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  gender: string;

  @Prop({ required: true })
  dob: string;

  @Prop({ required: true })
  tob: string;

  @Prop({ required: true })
  pob: string;

  @Prop()
  country?: string;

  @Prop()
  state?: string;

  @Prop({ type: Object })
  partnerDetails?: {
    name: string;
    dob: string;
    tob: string;
    pob: string;
    country?: string;
    state?: string;
    email?: string;
    phone?: string;
  };

  @Prop()
  language?: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['INR', 'USD'], default: 'INR' })
  currency: string;

  @Prop({
    required: true,
    enum: ['pending', 'paid', 'failed', 'cancelled', 'completed'],
    default: 'pending'
  })
  status: string;

  @Prop()
  razorpayOrderId?: string;

  @Prop()
  razorpayPaymentId?: string;

  @Prop()
  razorpaySignature?: string;

  @Prop()
  paidAt?: Date;
}

export const ReportBookingSchema = SchemaFactory.createForClass(ReportBooking);
