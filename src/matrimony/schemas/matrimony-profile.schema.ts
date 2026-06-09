import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatrimonyProfileDocument = MatrimonyProfile & Document;

@Schema({
  timestamps: true,
  collection: 'matrimony_profiles',
})
export class MatrimonyProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: false })
  bio: string;

  @Prop([String])
  photos: string[];

  // Profile Specifics
  @Prop({ required: false })
  height: string;

  @Prop({ required: false })
  weight: string;

  @Prop({ required: false })
  education: string;

  @Prop({ required: false })
  profession: string;

  @Prop({ required: false })
  income: string;

  @Prop({ required: false })
  religion: string;

  @Prop({ required: false })
  caste: string;

  @Prop({ required: false })
  motherTongue: string;

  @Prop({ required: false })
  hobbies: string;

  // Partner Preferences
  @Prop({
    type: {
      minAge: { type: Number, default: 18, min: 18 },
      maxAge: { type: Number, default: 50, min: 18 },
      location: [String],
      professions: [String],
    },
    default: () => ({ minAge: 18, maxAge: 50, location: [], professions: [] }),
  })
  partnerPreferences: {
    minAge: number;
    maxAge: number;
    location: string[];
    professions: string[];
  };

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  matchCount: number;
}

export const MatrimonyProfileSchema = SchemaFactory.createForClass(MatrimonyProfile);

// Core indexes
MatrimonyProfileSchema.index({ userId: 1 });
MatrimonyProfileSchema.index({ isActive: 1 });
MatrimonyProfileSchema.index({ religion: 1, caste: 1 });
