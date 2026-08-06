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
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
