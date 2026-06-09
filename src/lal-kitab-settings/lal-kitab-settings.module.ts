import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LalKitabSettingsController } from './lal-kitab-settings.controller';
import { LalKitabSettingsService } from './lal-kitab-settings.service';
import { LalKitabSettings, LalKitabSettingsSchema } from './schemas/lal-kitab-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LalKitabSettings.name, schema: LalKitabSettingsSchema },
    ]),
  ],
  controllers: [LalKitabSettingsController],
  providers: [LalKitabSettingsService],
  exports: [LalKitabSettingsService],
})
export class LalKitabSettingsModule {}
