import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { PageSeoSettingsService } from './page-seo-settings.service';
import { CreatePageSeoSettingDto } from './dto/create-page-seo-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('page-seo')
export class PageSeoSettingsController {
  constructor(private readonly pageSeoSettingsService: PageSeoSettingsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async createOrUpdate(@Body() dto: CreatePageSeoSettingDto) {
    const data = await this.pageSeoSettingsService.createOrUpdate(dto);
    return { success: true, data };
  }

  @Get()
  async findAll() {
    const data = await this.pageSeoSettingsService.findAll();
    return { success: true, data };
  }

  @Get('*slug')
  async findOne(@Param('slug') slug: string) {
    const data = await this.pageSeoSettingsService.findBySlug(slug);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.pageSeoSettingsService.remove(id);
    return { success: true, message: 'Deleted successfully' };
  }
}
