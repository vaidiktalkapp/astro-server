import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { PujasService } from './pujas.service';
import { CreatePujaDto } from './dto/create-puja.dto';

@Controller('pujas')
export class PujasController {
  constructor(private readonly pujasService: PujasService) {}

  @Post()
  create(@Body() createPujaDto: CreatePujaDto) {
    return this.pujasService.create(createPujaDto);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.pujasService.findAll(query);
  }

  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.pujasService.findOne(idOrSlug);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePujaDto: Partial<CreatePujaDto>) {
    return this.pujasService.update(id, updatePujaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pujasService.remove(id);
  }
}
