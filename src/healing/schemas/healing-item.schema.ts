import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HealingItemDocument = HealingItem & Document;

@Schema({ timestamps: true })
export class HealingItem {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true, enum: ['meditation', 'yoga', 'crystal'] })
  type: string;

  @Prop({ required: true })
  content: string; // Rich HTML content

  @Prop()
  shortDescription: string;

  @Prop()
  featuredImage: string;

  @Prop()
  youtubeUrl: string;

  @Prop({ type: Object })
  metadata: {
    duration?: string;      // for meditation
    focus?: string;         // for meditation
    benefits?: string[];    // for meditation/yoga
    sanskritName?: string;  // for yoga
    difficulty?: string;    // for yoga
    color?: string;         // for crystal
    chakra?: string;        // for crystal
    element?: string;       // for crystal
  };

  @Prop({ enum: ['Draft', 'Published', 'Archived'], default: 'Published' })
  status: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const HealingItemSchema = SchemaFactory.createForClass(HealingItem);
