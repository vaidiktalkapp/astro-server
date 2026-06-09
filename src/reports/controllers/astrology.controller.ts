import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { CalculateAstrologyDto } from '../../reports/dto/calculate-astrology.dto';

@ApiTags('Astrology')
@Controller('astrology')
export class AstrologyController {
  constructor(private readonly astronomyService: AstronomyService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate full Kundli, Panchang, and Dasha data' })
  @ApiResponse({ status: 200, description: 'Return calculation results' })
  async calculate(@Body() dto: CalculateAstrologyDto) {
    const result = await this.astronomyService.calculateAllData(
      dto.date,
      dto.time,
      dto.lat,
      dto.lon,
      dto.tzone
    );

    return {
      success: true,
      data: {
        ...result,
        input: {
          name: dto.name,
          date: dto.date,
          time: dto.time,
          place: dto.place
        }
      }
    };
  }
}
