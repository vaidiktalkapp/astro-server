import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PageSeoSettingDocument = PageSeoSetting & Document;

@Schema({ timestamps: true })
export class PageSeoSetting {
  @Prop({ required: true, unique: true, index: true })
  pageSlug: string; // e.g. "horoscope/yearly/aries" or "horoscope/tomorrow"

  @Prop()
  seoTitle?: string;

  @Prop()
  seoDescription?: string;

  @Prop()
  seoKeywords?: string;

  @Prop()
  schemaMarkup?: string; // For raw JSON-LD injected by admin

  @Prop({ type: [{ q: String, a: String }], default: [] })
  faqs: { q: string; a: string }[];
}

export const PageSeoSettingSchema = SchemaFactory.createForClass(PageSeoSetting);
