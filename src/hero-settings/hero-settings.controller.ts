import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { HeroSettingsService } from './hero-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('hero-settings')
export class HeroSettingsController {
  constructor(private readonly heroSettingsService: HeroSettingsService) {}

  @Get()
  async getSettings() {
    return this.heroSettingsService.getSettings();
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSettings(@Body() updateData: any) {
    return this.heroSettingsService.updateSettings(updateData);
  }
}
