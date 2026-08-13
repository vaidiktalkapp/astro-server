import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PageSeoSettingsService } from './page-seo-settings.service';
import { PageSeoSettingsController } from './page-seo-settings.controller';
import { PageSeoSetting, PageSeoSettingSchema } from './schemas/page-seo-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PageSeoSetting.name, schema: PageSeoSettingSchema }])
  ],
  controllers: [PageSeoSettingsController],
  providers: [PageSeoSettingsService],
  exports: [PageSeoSettingsService]
})
export class PageSeoSettingsModule {}
