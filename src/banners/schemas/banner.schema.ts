import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Banner extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  desktopImageUrl: string;

  @Prop()
  mobileImageUrl: string;

  @Prop()
  linkUrl: string;

  @Prop({ default: 'hero' })
  position: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;

  // --- Optional Override Fields (If empty, frontend falls back to default) ---
  @Prop() badgeText?: string;
  @Prop() headingPrefix?: string;
  @Prop() headingHighlight?: string;
  @Prop() headingSuffix?: string;
  @Prop() subheading?: string;

  @Prop() button1Text?: string;
  @Prop() button1Link?: string;

  @Prop() button2Text?: string;
  @Prop() button2Link?: string;

  @Prop() button3Text?: string;
  @Prop() button3Link?: string;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
