import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SeoSettingDocument = SeoSetting & Document;

@Schema({ timestamps: true })
export class SeoSetting {
  @Prop({ default: 'User-agent: *\nAllow: /\n\n# Sitemap\nSitemap: https://vaidiktalk.com/sitemap.xml' })
  robotsTxtContent: string;

  @Prop({ type: [String], default: [] })
  additionalSitemapUrls: string[];
}

export const SeoSettingSchema = SchemaFactory.createForClass(SeoSetting);
