import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ZodiacProfileDocument = ZodiacProfile & Document;

@Schema({ timestamps: true })
export class ZodiacProfile {
  @Prop({ required: true, unique: true })
  sign: string;

  @Prop({ required: false })
  icon: string;

  @Prop({ required: true })
  lovePersonality: string;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  @Prop({ required: true })
  elementInfo: string;

  @Prop({ type: [String], default: [] })
  compatibility: string[];
}

export const ZodiacProfileSchema = SchemaFactory.createForClass(ZodiacProfile);
