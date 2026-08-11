import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SeoSettingsService } from '../services/seo-settings.service';
import { UpdateSeoSettingsDto } from '../dto/update-seo-settings.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('seo-settings')
export class SeoSettingsController {
  constructor(private readonly seoSettingsService: SeoSettingsService) {}

  @Get()
  async getSettings() {
    const settings = await this.seoSettingsService.getSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSettings(@Body() updateDto: UpdateSeoSettingsDto) {
    const settings = await this.seoSettingsService.updateSettings(updateDto);
    return {
      success: true,
      data: settings,
      message: 'SEO settings updated successfully',
    };
  }
}
