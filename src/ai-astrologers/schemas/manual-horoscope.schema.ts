import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';  
import { Document } from 'mongoose';  
  
@Schema({ timestamps: true })  
export class ManualHoroscope extends Document {  
  @Prop({ required: true, index: true })  
  period: string; // 'today', 'tomorrow', 'weekly', 'monthly', 'yearly'  
  
  @Prop({ required: true, index: true })  
  language: string;  
  
  @Prop({ required: true, index: true })  
  sign: string; // 'aries', 'taurus', etc.  
  
  @Prop({ required: true, index: true })  
  dateIdentifier: string; // e.g. '2026-08-02' for daily, '2026-W31' for weekly  
  
  @Prop({ type: Object, required: true })  
  readingData: any; // { reading: string, mood: string, luckyNumber: number, color: string, stats: any }  

  @Prop({ type: Date, default: Date.now, expires: '30d' }) // Automatically delete after 30 days
  createdAt: Date;
}  
  
export const ManualHoroscopeSchema = SchemaFactory.createForClass(ManualHoroscope);  
ManualHoroscopeSchema.index({ period: 1, language: 1, sign: 1, dateIdentifier: 1 }, { unique: true }); 
