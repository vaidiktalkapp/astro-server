import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BabyNameDocument = BabyName & Document;

@Schema({ timestamps: true })
export class BabyName {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  meaning: string;

  @Prop({ required: true, enum: ['Boy', 'Girl', 'Unisex'] })
  gender: string;

  @Prop({ required: true, uppercase: true })
  startingLetter: string;

  @Prop({ required: true })
  nameLength: number;

  @Prop({ required: false })
  numerologyNumber: number;

  @Prop({ required: false })
  zodiacSign: string; // Aries, Taurus, etc.

  @Prop({ required: false })
  nakshatra: string; // Ashwini, Bharani, etc.

  @Prop({ required: false })
  origin: string; // e.g. Hindi, Sanskrit, Tamil

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: ['alphabet'] })
  discoveryTypes: string[];
}

export const BabyNameSchema = SchemaFactory.createForClass(BabyName);

// Index for fast queries
BabyNameSchema.index({ name: 1, gender: 1 }, { unique: true });
BabyNameSchema.index({ startingLetter: 1, gender: 1 });
BabyNameSchema.index({ zodiacSign: 1 });
BabyNameSchema.index({ nakshatra: 1 });
BabyNameSchema.index({ discoveryTypes: 1 });
BabyNameSchema.index({ name: 'text', meaning: 'text' });
