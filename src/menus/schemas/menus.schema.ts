import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Menu extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, index: true })
  category: string; // The slug that connects sub-menus to top-level menus

  @Prop({ default: false })
  isTopLevel: boolean;

  @Prop({ default: 'General' })
  group: string; // 'Premium Reports', 'Time-Based Forecasts', etc.

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  badge: string; // 'Free', 'New', etc.

  @Prop()
  icon: string; // Custom emoji or SVG string
}

export const MenuSchema = SchemaFactory.createForClass(Menu);
