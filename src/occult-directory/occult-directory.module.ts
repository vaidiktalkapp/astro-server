import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OccultDirectoryService } from './occult-directory.service';
import { OccultDirectoryController } from './occult-directory.controller';
import {
  DirectorySettings,
  DirectorySettingsSchema,
} from './schemas/directory-settings.schema';

import {
  Astrologer,
  AstrologerSchema,
} from '../astrologers/schemas/astrologer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DirectorySettings.name, schema: DirectorySettingsSchema },
      { name: Astrologer.name, schema: AstrologerSchema },
    ]),
  ],
  controllers: [OccultDirectoryController],
  providers: [OccultDirectoryService],
  exports: [OccultDirectoryService],
})
export class OccultDirectoryModule {}
