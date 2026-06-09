import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MatrimonyChatSettingsDocument = MatrimonyChatSettings & Document;

@Schema({ timestamps: true, collection: 'matrimony_chat_settings' })
export class MatrimonyChatSettings {
  @Prop({ default: 'global', unique: true })
  key: string; 

  @Prop({ default: true })
  isEnabled: boolean;

  @Prop({
    type: [
      {
        messageCount: { type: Number, required: true },
        price: { type: Number, required: true },
        label: { type: String },
      },
    ],
    default: [
      { messageCount: 10, price: 20, label: 'Starter Pack' },
      { messageCount: 50, price: 50, label: 'Popular Pack' },
      { messageCount: 200, price: 150, label: 'Unlimited Vibes' },
    ],
  })
  pricingTiers: {
    messageCount: number;
    price: number;
    label?: string;
  }[];
}

export const MatrimonyChatSettingsSchema = SchemaFactory.createForClass(MatrimonyChatSettings);
