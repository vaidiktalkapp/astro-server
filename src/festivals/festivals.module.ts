import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FestivalsService } from './festivals.service';
import { FestivalsController } from './festivals.controller';
import { Festival, FestivalSchema } from './schemas/festival.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Festival.name, schema: FestivalSchema }]),
  ],
  controllers: [FestivalsController],
  providers: [FestivalsService],
})
export class FestivalsModule {}
