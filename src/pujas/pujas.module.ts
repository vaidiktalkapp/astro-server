import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PujasController } from './pujas.controller';
import { PujasService } from './pujas.service';
import { Puja, PujaSchema } from './schemas/puja.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Puja.name, schema: PujaSchema }])],
  controllers: [PujasController],
  providers: [PujasService],
})
export class PujasModule {}
