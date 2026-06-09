import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompatibilitySettingsController } from './compatibility-settings.controller';
import { CompatibilitySettingsService } from './compatibility-settings.service';
import { CompatibilitySettings, CompatibilitySettingsSchema } from './schemas/compatibility-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompatibilitySettings.name, schema: CompatibilitySettingsSchema },
    ]),
  ],
  controllers: [CompatibilitySettingsController],
  providers: [CompatibilitySettingsService],
  exports: [CompatibilitySettingsService],
})
export class CompatibilitySettingsModule {}
