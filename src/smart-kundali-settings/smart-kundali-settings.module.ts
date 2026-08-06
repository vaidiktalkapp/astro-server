import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmartKundaliSettingsController } from './smart-kundali-settings.controller';
import { SmartKundaliSettingsService } from './smart-kundali-settings.service';
import { SmartKundaliSetting, SmartKundaliSettingSchema } from './schemas/smart-kundali-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SmartKundaliSetting.name, schema: SmartKundaliSettingSchema }])
  ],
  controllers: [SmartKundaliSettingsController],
  providers: [SmartKundaliSettingsService],
  exports: [SmartKundaliSettingsService]
})
export class SmartKundaliSettingsModule {}
