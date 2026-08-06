import { Controller, Get, Put, Body } from '@nestjs/common';
import { HeroSettingsService } from './hero-settings.service';

@Controller('hero-settings')
export class HeroSettingsController {
  constructor(private readonly heroSettingsService: HeroSettingsService) {}

  @Get()
  async getSettings() {
    return this.heroSettingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() updateData: any) {
    return this.heroSettingsService.updateSettings(updateData);
  }
}
