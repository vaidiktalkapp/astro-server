import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemSettingsDocument = SystemSettings & Document;

@Schema({ timestamps: true, collection: 'system_settings' })
export class SystemSettings {
  @Prop({ required: true, default: 50, min: 0, max: 100 })
  defaultPlatformCommissionRate: number;

  @Prop({ required: true, default: false })
  isAiFirstCallFreeEnabled: boolean;

  @Prop({ required: true, default: 1, min: 1, max: 30 })
  aiFirstCallFreeDurationMinutes: number;

  @Prop({ default: false })
  isWelcomeBonusEnabled: boolean;

  @Prop({ default: 100, min: 0 })
  welcomeBonusAmount: number;

  @Prop({ default: false })
  isInteraktWelcomeEnabled: boolean;

  @Prop({ default: 'welcome_bonus' })
  interaktWelcomeTemplateName: string;


  @Prop({ default: false })
  isPromoBannerActive: boolean;

  @Prop({ default: 'First Call/Chat FREE' })
  promoBannerTitle: string;

  @Prop({ default: 'Consult Expert AI Astrologers' })
  promoBannerSubtitle: string;

  @Prop({ default: 'Call Now' })
  promoBannerCallText: string;

  @Prop({ default: 'Chat Now' })
  promoBannerChatText: string;

  @Prop({ default: true })
  promoBannerShowCall: boolean;

  @Prop({ default: true })
  promoBannerShowChat: boolean;

  @Prop({ default: '' })
  promoBannerImage: string;

  @Prop({ default: '' })
  promoBannerRedirectRoute: string;
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
