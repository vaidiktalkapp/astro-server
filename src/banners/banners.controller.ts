import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { BannersService } from './banners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query() query: any) {
    // If it's a public request (no admin), maybe we only want active banners
    // But since it's simple, we'll let the query params decide
    return this.bannersService.findAll(query);
  }

  @Get('active')
  findActive() {
    return this.bannersService.findAll({ isActive: true });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() createData: any) {
    return this.bannersService.create(createData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.bannersService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
