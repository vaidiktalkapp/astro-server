import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HeroSettingsController } from './hero-settings.controller';
import { HeroSettingsService } from './hero-settings.service';
import { HeroSetting, HeroSettingSchema } from './schemas/hero-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HeroSetting.name, schema: HeroSettingSchema }]),
  ],
  controllers: [HeroSettingsController],
  providers: [HeroSettingsService],
})
export class HeroSettingsModule {}
