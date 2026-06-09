import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PdfPricing extends Document {
  @Prop({ required: true, unique: true })
  toolKey: string; // e.g. 'compatibility', 'kundli'

  @Prop({ required: true })
  toolName: string; // e.g. 'Love & Name Compatibility'

  @Prop({ required: true, default: 0 })
  price: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PdfPricingSchema = SchemaFactory.createForClass(PdfPricing);
