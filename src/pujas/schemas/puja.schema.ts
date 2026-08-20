import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PujaDocument = Puja & Document;

@Schema({ timestamps: true })
export class Puja {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  shortDesc: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  discountedPrice: number;

  @Prop()
  image: string;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;

  @Prop({ default: false })
  popular: boolean;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: [{ q: String, a: String }], default: [] })
  faqs: { q: string; a: string }[];

  @Prop()
  duration: string;

  @Prop()
  rating: string;

  @Prop()
  reviews: string;

  @Prop({ type: [String], default: [] })
  benefits: string[];

  @Prop()
  category: string;

  @Prop()
  deity: string;

  @Prop()
  wisdomCardTitle: string;

  @Prop()
  wisdomCardText: string;

  @Prop({ type: [{ name: String, city: String, date: String, review: String, initial: String, color: String }], default: [] })
  testimonials: { name: string; city: string; date: string; review: string; initial: string; color: string }[];

  @Prop({ type: [{ youtubeId: String, title: String }], default: [] })
  videoTestimonials: { youtubeId: string; title: string }[];

  @Prop({ type: [{ title: String, slug: String, price: String, img: String, tag: String }], default: [] })
  relatedPujas: { title: string; slug: string; price: string; img: string; tag: string }[];

  @Prop({ type: [String], default: [] })
  gallery: string[];

  @Prop({ type: [String], default: [] })
  processSteps: string[];

  @Prop({ type: [String], default: [] })
  whyChooseUs: string[];

  @Prop({ default: '' })
  extraContent: string;

  @Prop({ type: [{ id: String, title: String, desc: String, price: Number, img: String }], default: [] })
  offerings: { id: string; title: string; desc: string; price: number; img: string }[];

  @Prop({ type: [{ name: String, sub: String, perks: [String], price: Number, orig: Number }], default: [] })
  packages: { name: string; sub: string; perks: string[]; price: number; orig: number }[];

  // SEO Fields
  @Prop({ default: '' })
  seoTitle: string;

  @Prop({ default: '' })
  seoDescription: string;

  @Prop({ default: '' })
  seoKeywords: string;

  @Prop({ default: '' })
  schemaMarkup: string;
}

export const PujaSchema = SchemaFactory.createForClass(Puja);
