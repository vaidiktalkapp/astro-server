import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FaqDocument = Faq & Document;

@Schema({ timestamps: true })
export class Faq {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;

  @Prop({ default: 0 })
  order: number;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
