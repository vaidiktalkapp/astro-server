import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CelebrityService } from './celebrity.service';
import { CelebrityController } from './celebrity.controller';
import { Celebrity, CelebritySchema } from './schemas/celebrity.schema';
import { AdminModule } from '../admin/admin.module';

import { AiAstrologersModule } from '../ai-astrologers/ai-astrologers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Celebrity.name, schema: CelebritySchema }]),
    AiAstrologersModule,
    forwardRef(() => AdminModule),
  ],

  controllers: [CelebrityController],
  providers: [CelebrityService],
  exports: [CelebrityService],
})
export class CelebrityModule {}
