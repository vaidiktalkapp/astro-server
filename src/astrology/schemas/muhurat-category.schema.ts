import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MuhuratCategoryDocument = MuhuratCategory & Document;

@Schema({ timestamps: true })
export class MuhuratCategory {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: false })
  icon: string; // Lucide icon name

  @Prop({ required: false })
  subtitle: string; // Subtitle shown on frontend

  @Prop({ required: false })
  description: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: false })
  aiPrompt: string; // Optional prompt override for this category
}

export const MuhuratCategorySchema = SchemaFactory.createForClass(MuhuratCategory);
