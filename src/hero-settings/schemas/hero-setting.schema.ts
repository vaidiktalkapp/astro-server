
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class HeroSetting extends Document {
  @Prop({ default: "India's Most Trusted Vedic Guidance Platform" })
  badgeText: string;

  @Prop({ default: 'Get Trusted' })
  headingPrefix: string;

  @Prop({ default: 'Vedic Guidance' })
  headingHighlight: string;

  @Prop({ default: 'for Every Step of Your Life' })
  headingSuffix: string;

  @Prop({ default: "Chat, call, or consult with India's best astrologers and get accurate solutions to your life's challenges." })
  subheading: string;
}

export const HeroSettingSchema = SchemaFactory.createForClass(HeroSetting);
