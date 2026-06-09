import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { LalKitabSettingsService } from './lal-kitab-settings.service';
import { UpdateLalKitabSettingsDto } from './dto/update-lal-kitab-settings.dto';

@Controller('lal-kitab-settings')
export class LalKitabSettingsController {
  constructor(private readonly settingsService: LalKitabSettingsService) {}

  @Get()
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() dto: UpdateLalKitabSettingsDto) {
    return await this.settingsService.updateSettings(dto);
  }
}
