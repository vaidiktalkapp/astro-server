import { Controller, Get, Param, Query } from '@nestjs/common';
import { BabyNameService } from '../services/baby-name.service';

@Controller('baby-names')
export class BabyNameController {

  constructor(private readonly babyNameService: BabyNameService) {}

  // GET /api/v1/baby-names/stats
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.babyNameService.getStats();
      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // GET /api/v1/baby-names/search?q=aarav&gender=Boy&page=1
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('gender') gender?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.babyNameService.search(
        query || '',
        gender,
        parseInt(page || '1'),
        parseInt(limit || '50'),
      );
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // GET /api/v1/baby-names/alphabet/A?gender=Boy&page=1
  @Get('alphabet/:letter')
  async getByAlphabet(
    @Param('letter') letter: string,
    @Query('gender') gender?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.babyNameService.getByAlphabet(
        letter,
        gender,
        parseInt(page || '1'),
        parseInt(limit || '50'),
      );
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // GET /api/v1/baby-names/zodiac/Aries?gender=Girl&page=1
  @Get('zodiac/:sign')
  async getByZodiac(
    @Param('sign') sign: string,
    @Query('gender') gender?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.babyNameService.getByZodiac(
        sign,
        gender,
        parseInt(page || '1'),
        parseInt(limit || '50'),
      );
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // GET /api/v1/baby-names/nakshatra/Ashwini?gender=Boy&page=1
  @Get('nakshatra/:nakshatra')
  async getByNakshatra(
    @Param('nakshatra') nakshatra: string,
    @Query('gender') gender?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.babyNameService.getByNakshatra(
        nakshatra,
        gender,
        parseInt(page || '1'),
        parseInt(limit || '50'),
      );
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
