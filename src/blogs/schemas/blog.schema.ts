import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Blog extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  content: string; // Rich text HTML content

  @Prop()
  bannerImage: string; // URL for the banner image

  @Prop()
  bannerAlt: string; // SEO alt text for the banner image

  @Prop({ type: Types.ObjectId, ref: 'BlogCategory' })
  category: Types.ObjectId;

  @Prop({ default: 'draft', enum: ['draft', 'published'] })
  status: string;

  @Prop({ default: false })
  isFeatured: boolean; // Show on Home Page

  @Prop({ default: 0 })
  views: number;

  @Prop()
  seoTitle: string;

  @Prop()
  seoDescription: string;

  @Prop()
  seoKeywords: string;

  @Prop({ default: 'VaidikTalk Editorial' })
  authorName: string;

  @Prop()
  authorCredentials: string; // e.g. "Vedic Astrologer, 15+ Years Experience"

  @Prop()
  publishedAt: Date;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
