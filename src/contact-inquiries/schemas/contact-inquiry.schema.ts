import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactInquiryDocument = ContactInquiry & Document;

@Schema({ timestamps: true })
export class ContactInquiry {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'PENDING', enum: ['PENDING', 'RESOLVED', 'SPAM'] })
  status: string;

  @Prop()
  notes?: string;
}

export const ContactInquirySchema = SchemaFactory.createForClass(ContactInquiry);
