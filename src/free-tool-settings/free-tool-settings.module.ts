import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FreeToolSettingsService } from './free-tool-settings.service';
import { FreeToolSettingsController } from './free-tool-settings.controller';
import { FreeToolSettings, FreeToolSettingsSchema } from './schemas/free-tool-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FreeToolSettings.name, schema: FreeToolSettingsSchema }]),
  ],
  providers: [FreeToolSettingsService],
  controllers: [FreeToolSettingsController],
  exports: [FreeToolSettingsService],
})
export class FreeToolSettingsModule {}
