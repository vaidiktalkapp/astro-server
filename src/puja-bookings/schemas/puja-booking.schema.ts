import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PujaBookingDocument = PujaBooking & Document;

@Schema({ timestamps: true, collection: 'puja_bookings' })
export class PujaBooking {
  @Prop({ required: true, unique: true })
  bookingId: string; // e.g. PUJA-123456789

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId; // Optional, if user is logged in

  @Prop({ required: true })
  pujaName: string;

  @Prop({ required: true })
  pujaSlug: string;

  @Prop({ required: true })
  customerName: string;

  @Prop()
  gotra?: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  preferredDate: Date;

  @Prop()
  message?: string;

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

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const PujaBookingSchema = SchemaFactory.createForClass(PujaBooking);
