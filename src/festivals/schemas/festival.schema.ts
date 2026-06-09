import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FestivalDocument = Festival & Document;

@Schema({ timestamps: true })
export class Festival {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  date: string; // ISO string e.g. "2026-03-03"

  @Prop()
  endDate: string;

  @Prop()
  tithi: string;

  @Prop()
  month: string;

  @Prop({ default: 'None' })
  deity: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  rituals: string[];

  @Prop()
  muhurat: string;

  @Prop({ default: '#b8962e' })
  color: string;

  @Prop({ default: false })
  isMajor: boolean;
}

export const FestivalSchema = SchemaFactory.createForClass(Festival);
