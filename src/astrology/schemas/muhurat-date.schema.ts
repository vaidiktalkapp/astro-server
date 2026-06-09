import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MuhuratManualDateDocument = MuhuratManualDate & Document;

@Schema({ timestamps: true })
export class MuhuratManualDate {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'MuhuratCategory', required: true })
  categoryId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  date: string; // ISO string or specific format YYYY-MM-DD

  @Prop({ required: true })
  nakshatra: string;

  @Prop({ required: true })
  tithi: string;

  @Prop({ required: true })
  muhurat_start: string;

  @Prop({ required: true })
  muhurat_end: string;

  @Prop({ required: false })
  sun_rise: string;

  @Prop({ required: false })
  sun_set: string;

  @Prop({ default: 100 })
  quality_score: number;

  @Prop({ type: [String], default: [] })
  reasons_good: string[];

  @Prop({ required: false })
  aiVerdict: string; // Optional manual override for the AI text

  @Prop({ default: false })
  isFullDay: boolean;
}

export const MuhuratManualDateSchema = SchemaFactory.createForClass(MuhuratManualDate);

// Indexing for quick lookups by category and date
MuhuratManualDateSchema.index({ categoryId: 1, date: 1 }, { unique: true });
