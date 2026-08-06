import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SmartKundaliSettingsService } from './smart-kundali-settings.service';

@Controller('smart-kundali-settings')
export class SmartKundaliSettingsController {
  constructor(private readonly service: SmartKundaliSettingsService) { }

  @Get('/:reportSlug')
  getSettings(@Param('reportSlug') reportSlug: string) {
    return this.service.getSettings(reportSlug);
  }

  @Put('/:reportSlug')
  updateSettings(@Param('reportSlug') reportSlug: string, @Body() updateData: any) {
    return this.service.updateSettings(reportSlug, updateData);
  }
}
