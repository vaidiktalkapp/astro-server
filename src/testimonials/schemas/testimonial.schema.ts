import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TestimonialDocument = Testimonial & Document;

@Schema({ timestamps: true })
export class Testimonial {
  @Prop({ required: true })
  name: string;

  @Prop()
  city: string;

  @Prop()
  youtubeLink: string;

  @Prop()
  review: string;

  @Prop()
  videoId: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'global' })
  category: string;
}

export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);
