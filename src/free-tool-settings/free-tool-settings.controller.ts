import { Controller, Get, Put, Body } from '@nestjs/common';
import { FreeToolSettingsService } from './free-tool-settings.service';
import { UpdateFreeToolSettingsDto } from './dto/update-free-tool-settings.dto';

@Controller('free-tool-settings')
export class FreeToolSettingsController {
  constructor(private readonly freeToolSettingsService: FreeToolSettingsService) {}

  @Get()
  async getSettings() {
    return this.freeToolSettingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() updateDto: UpdateFreeToolSettingsDto) {
    return this.freeToolSettingsService.updateSettings(updateDto);
  }
}
