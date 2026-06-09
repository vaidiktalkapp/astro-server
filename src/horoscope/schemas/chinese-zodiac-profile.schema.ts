import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChineseZodiacProfile extends Document {
  @Prop({ required: true, unique: true, index: true })
  name: string; // Rat, Ox, Tiger, etc.

  @Prop({ required: true })
  icon: string; // Emoji or SVG path

  @Prop({ required: true })
  personality: string;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  @Prop({ type: [String], default: [] })
  famousPeople: string[];

  @Prop({ required: true })
  elementInfo: string;

  @Prop({ type: [String], default: [] })
  compatibility: string[];
}

export const ChineseZodiacProfileSchema = SchemaFactory.createForClass(ChineseZodiacProfile);
