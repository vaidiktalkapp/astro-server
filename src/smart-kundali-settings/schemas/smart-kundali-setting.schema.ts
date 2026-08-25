import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SmartKundaliSettingDocument = SmartKundaliSetting & Document;

@Schema()
export class VideoSetting {
  @Prop({ default: '' })
  url: string;

  @Prop({ default: '' })
  thumbnail: string;
}

@Schema()
export class BannerSetting {
  @Prop({ default: '' })
  url: string;
}

@Schema()
export class ScreenshotSetting {
  @Prop({ required: true })
  url: string;
}

@Schema()
export class CarouselVideoSetting {
  @Prop({ required: true })
  url: string;
}

@Schema()
export class MockupsSetting {
  @Prop({ default: '' })
  pdf: string;

  @Prop({ default: '' })
  mobile: string;

  @Prop({ default: '' })
  desktop: string;
}

@Schema()
export class SamplePdfSetting {
  @Prop({ default: '' })
  url: string;
}

@Schema()
export class TestimonialSetting {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  review: string;

  @Prop({ required: true })
  initial: string;

  @Prop({ required: true })
  color: string;
}

@Schema()
export class FaqSetting {
  @Prop({ required: true })
  q: string;

  @Prop({ required: true })
  a: string;
}

@Schema()
export class SuccessStorySetting {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  before: string;

  @Prop({ required: true })
  after: string;
}

@Schema({ timestamps: true })
export class SmartKundaliSetting {
  @Prop({ required: true, unique: true })
  reportSlug: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 0 })
  discountedPrice: number;

  @Prop({ default: 0 })
  astrologerConsultationPrice: number;

  @Prop({ default: 0 })
  expressDeliveryPrice: number;

  @Prop({ type: VideoSetting, default: () => ({}) })
  video: VideoSetting;

  @Prop({ type: BannerSetting, default: () => ({}) })
  banner: BannerSetting;

  @Prop({ type: [ScreenshotSetting], default: [] })
  screenshots: ScreenshotSetting[];

  @Prop({ type: [CarouselVideoSetting], default: [] })
  videos: CarouselVideoSetting[];

  @Prop({ type: [TestimonialSetting], default: [] })
  testimonials: TestimonialSetting[];

  @Prop({ type: [FaqSetting], default: [] })
  faqs: FaqSetting[];

  @Prop({ type: [SuccessStorySetting], default: [] })
  successStories: SuccessStorySetting[];

  @Prop({ type: SamplePdfSetting, default: () => ({}) })
  samplePdf: SamplePdfSetting;

  @Prop({ type: MockupsSetting, default: () => ({}) })
  mockups: MockupsSetting;

  // SEO Fields
  @Prop({ default: '' })
  seoTitle: string;

  @Prop({ default: '' })
  seoDescription: string;

  @Prop({ default: '' })
  seoKeywords: string;

  @Prop({ default: '' })
  schemaMarkup: string;

  @Prop({ default: '' })
  extraContent: string;

  @Prop({ default: '' })
  heroHeading: string;

  @Prop({ default: '' })
  heroSubheading: string;

  @Prop({ type: [String], default: [] })
  productFeatures: string[];

  @Prop({ type: [String], default: [] })
  whatItReveals: string[];

  @Prop({ default: '' })
  productHeading: string;

  @Prop({ default: '' })
  productDescription: string;

  @Prop({ default: '' })
  whatItRevealsHeading: string;

  @Prop({ default: '' })
  highlightsHeading: string;

  @Prop({ default: '' })
  highlightsSubheading: string;

  @Prop({ type: [String], default: [] })
  highlightTags: string[];

  @Prop({ type: [String], default: [] })
  featureCards: string[];

  @Prop({ default: '' })
  heroCtaText: string;

  @Prop({ default: '' })
  imageSectionCtaText: string;

  @Prop({ default: '' })
  videoSectionCtaText: string;

  @Prop({ default: '' })
  bottomCtaText: string;

  @Prop({ default: '' })
  stickyCtaText: string;
}

export const SmartKundaliSettingSchema = SchemaFactory.createForClass(SmartKundaliSetting);
