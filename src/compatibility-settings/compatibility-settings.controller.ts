import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { CompatibilitySettingsService } from './compatibility-settings.service';
import { UpdateCompatibilitySettingsDto } from './dto/update-compatibility-settings.dto';

@Controller('compatibility-settings')
export class CompatibilitySettingsController {
  constructor(private readonly compatibilitySettingsService: CompatibilitySettingsService) {}

  @Get()
  async getSettings() {
    return this.compatibilitySettingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() updateDto: UpdateCompatibilitySettingsDto) {
    return this.compatibilitySettingsService.updateSettings(updateDto);
  }
}
