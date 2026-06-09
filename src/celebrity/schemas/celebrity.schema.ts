import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CelebrityDocument = Celebrity & Document;

@Schema({ timestamps: true })
export class Celebrity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  image: string;

  @Prop()
  category: string; // e.g. Bollywood, Sports, Politics

  @Prop({ required: true })
  birthDate: string; // YYYY-MM-DD

  @Prop()
  birthTime: string; // HH:mm

  @Prop({ required: true })
  birthPlace: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  timezone: number;

  @Prop()
  summary: string;

  @Prop()
  content: string; // Detailed Astrology Insights (HTML)

  @Prop({ type: Object })
  kundliData: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const CelebritySchema = SchemaFactory.createForClass(Celebrity);
