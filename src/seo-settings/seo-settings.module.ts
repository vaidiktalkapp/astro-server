import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeoSettingsController } from './controllers/seo-settings.controller';
import { SeoSettingsService } from './services/seo-settings.service';
import { SeoSetting, SeoSettingSchema } from './schemas/seo-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SeoSetting.name, schema: SeoSettingSchema }]),
  ],
  controllers: [SeoSettingsController],
  providers: [SeoSettingsService],
  exports: [SeoSettingsService],
})
export class SeoSettingsModule {}
