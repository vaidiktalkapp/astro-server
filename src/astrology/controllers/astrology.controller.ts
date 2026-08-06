import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { CalculateAstrologyDto } from '../dto/calculate-astrology.dto';
import { MuhuratService } from '../services/muhurat.service';
import { UseGuards, Req, Delete, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../../admin/core/guards/admin-auth.guard';
import { AstrologyHistoryService } from '../services/astrology-history.service';
import { SaveAstrologyHistoryDto } from '../dto/astrology-history.dto';
import { AiAstrologyEngineService } from '../../ai-astrologers/services/ai-astrology-engine.service';
import { NumerologyService } from '../services/numerology.service';
import { AstrologyContentService } from '../services/astrology-content.service';
import { RASHI_CLASSICS } from '../constants/rashi-classics';
import { CompatibilityLogicService } from '../services/compatibility-logic.service';

@ApiTags('Astrology')
@Controller('astrology')
export class AstrologyController {
  @Get('atlas')
  @ApiOperation({ summary: 'Geocode a city name for Atlas tool' })
  async geocodeAtlas(@Query('q') q: string) {
    if (!q) return { success: false, message: 'Query is required' };
    try {
        const result = await this.astronomyService.geocodePlaceOfBirth(q);
        return { success: true, data: { name: q, ...result } };
    } catch (error: any) {
        return { success: false, message: error.message || 'Location not found' };
    }
  }

  constructor(
    private readonly astronomyService: AstronomyService,
    private readonly aiEngine: AiAstrologyEngineService,
    private readonly muhuratService: MuhuratService,
    private readonly historyService: AstrologyHistoryService,
    private readonly contentService: AstrologyContentService,
    private readonly numerologyService: NumerologyService,
    private readonly compatibilityLogic: CompatibilityLogicService,
  ) {}

  @Post('lal-kitab')
  @ApiOperation({ summary: 'Get specialized Lal Kitab remedies and effects' })
  @ApiResponse({ status: 200, description: 'Return Lal Kitab data' })
  async lalKitab(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getLalKitabData(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('numerology')
  @ApiOperation({ summary: 'Calculate Numerology numbers and characteristics' })
  @ApiResponse({ status: 200, description: 'Return Numerology Data' })
  async calculateNumerology(@Body() dto: { name: string, dateOfBirth: string }) {
    try {
        const result = await this.numerologyService.calculateNumerology(dto.name, dto.dateOfBirth);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate full Kundli, Panchang, and Dasha data' })
  @ApiResponse({ status: 200, description: 'Return calculation results' })
  async calculate(@Body() dto: CalculateAstrologyDto) {
    try {
        const result = await this.astronomyService.calculateAllData(
            dto.date,
            dto.time,
            dto.lat,
            dto.lon,
            dto.tzone || 5.5
          );
      
          return {
            success: true,
            data: {
              ...result,
              input: {
                name: dto.name,
                date: dto.date,
                time: dto.time,
                place: dto.place,
                lat: dto.lat,
                lon: dto.lon,
                tzone: dto.tzone || 5.5
              }
            }
          };
    } catch (err: any) {
        return {
            success: false,
            message: err.message || 'Calculation failed'
        };
    }
  }

  @Post('match')
  @ApiOperation({ summary: 'Calculate compatibility' })
  @ApiResponse({ status: 200, description: 'Return matching results' })
  async matchHoroscope(@Body() dto: any) {
    try {
        const result = await this.astronomyService.matchHoroscope(dto.boy, dto.girl, dto.system);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('compatibility-report')
  @ApiOperation({ summary: 'Get AI compatibility report (Public)' })
  @ApiResponse({ status: 200, description: 'Return AI compatibility analysis' })
  async getCompatibilityReport(@Body() dto: { query: string, language?: string }) {
    try {
        const result = await this.aiEngine.getCompatibilityAnalysis(dto.query, dto.language || 'English');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('compatibility-calc')
  @ApiOperation({ summary: 'Calculate love compatibility locally' })
  async calculateCompatibility(@Body() dto: any) {
    try {
      let { idx1, idx2, mode, date1, date2, name1, name2 } = dto;
      const isSunSign = mode === 'date';
      
      if (mode === 'date') {
        idx1 = this.compatibilityLogic.getZodiacFromDate(date1);
        idx2 = this.compatibilityLogic.getZodiacFromDate(date2);
      }
      
      if (idx1 < 0 || idx2 < 0 || idx1 === null || idx2 === null) {
        return { success: false, message: 'Invalid zodiac indices or dates' };
      }
      
      const result = await this.compatibilityLogic.calculateCompatibility(idx1, idx2, name1, name2, isSunSign);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Post('name-compatibility-report')
  @ApiOperation({ summary: 'Get AI name compatibility report' })
  @ApiResponse({ status: 200, description: 'Return AI name compatibility analysis' })
  async getNameCompatibilityReport(@Body() dto: { query: string, language?: string }) {
    try {
        const result = await this.aiEngine.getNameCompatibilityAnalysis(dto.query, dto.language || 'English');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('name-calc')
  @ApiOperation({ summary: 'Calculate name compatibility locally' })
  async calculateNameCompatibility(@Body() dto: { name1: string, name2: string }) {
    try {
      const result = await this.numerologyService.calculateNameCompatibility(dto.name1, dto.name2);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Post('calendar')
  @ApiOperation({ summary: 'Calculate Monthly Astrology Calendar' })
  @ApiResponse({ status: 200, description: 'Return monthly calendar data' })
  async getCalendar(@Body() dto: any) {
    try {
        const result = await this.astronomyService.calculateCalendar(
            dto.year,
            dto.month,
            dto.lat,
            dto.lon,
            dto.tzone || 5.5
        );
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('today')
  @ApiOperation({ summary: 'Get detailed Panchang for today or a specific date' })
  @ApiResponse({ status: 200, description: 'Return detailed today panchang data' })
  async getTodayPanchang(@Body() dto: any) {
    try {
        const result = await this.astronomyService.getTodayPanchang(
            dto.lat,
            dto.lon,
            dto.tzone || 5.5,
            dto.date
        );
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('moon-sign')
  @ApiOperation({ summary: 'Get detailed Moon Sign personality reading' })
  @ApiResponse({ status: 200, description: 'Return Moon Sign reading data' })
  async getMoonSign(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getMoonSignReading(dto);
        const sign = result.moonSign || 'Capricorn';
        const classicsData = RASHI_CLASSICS[sign] || null;
        
        return { success: true, data: { ...result, classicsData } };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('love-horoscope')
  @ApiOperation({ summary: 'Get personalized Love Horoscope reading' })
  @ApiResponse({ status: 200, description: 'Return personalized Love Reading' })
  async getLoveHoroscope(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getLoveReading(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('zodiac-love')
  @ApiOperation({ summary: 'Get general Zodiac Love Horoscope' })
  @ApiResponse({ status: 200, description: 'Return Zodiac Love Reading' })
  async getZodiacLove(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getZodiacLoveReading(dto.sign, dto.period || 'daily', dto.language);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('daily-horoscope')
  @ApiOperation({ summary: 'Get daily horoscope for all 12 signs' })
  @ApiResponse({ status: 200, description: 'Return Daily Horoscope Data' })
  async getDailyHoroscopeAllSigns(
    @Query('period') period: string = 'today',
    @Query('language') language: string = 'English'
  ) {
    try {
        const result = await this.aiEngine.getDailyHoroscopeAllSigns(period, language);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // CHINESE ZODIAC USER ENDPOINTS
  // -------------------------------------------------------------------------

  @Post('chinese-zodiac')
  @ApiOperation({ summary: 'Get general Chinese Zodiac reading' })
  async getChineseZodiac(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getChineseZodiacReading(dto.sign, dto.period || 'daily', dto.language);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('chinese-personal')
  @ApiOperation({ summary: 'Get deep personal Chinese destiny analysis' })
  async getChinesePersonal(@Body() dto: any) {
    try {
        const result = await this.aiEngine.getPersonalChineseReading(dto.name, dto.date, dto.language);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('chinese-profiles')
  @ApiOperation({ summary: 'Get all 12 Chinese Zodiac animal profiles' })
  async getChineseProfiles() {
    try {
        const result = await (this.aiEngine as any).horoscopeService.findAllChineseProfiles();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('zodiac-profiles')
  @ApiOperation({ summary: 'Get all 12 Western Zodiac profiles' })
  async getZodiacProfiles() {
    try {
        const result = await (this.aiEngine as any).horoscopeService.findAllZodiacProfiles();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('muhurat')
  @ApiOperation({ summary: 'Calculate auspicious Muhurat dates for ceremonies' })
  @ApiResponse({ status: 200, description: 'Return muhurat calculation results' })
  async calculateMuhurat(@Body() dto: any) {
    try {
        const result = await this.muhuratService.calculateMuhuratMerged(
            dto.category || 'marriage',
            dto.startDate,
            dto.endDate,
            dto.lat,
            dto.lon,
            dto.tzone || 5.5,
            dto.language || 'English'
        );
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('muhurat/categories')
  @ApiOperation({ summary: 'Get all managed Muhurat categories' })
  async getMuhuratCategories() {
    try {
        const categories = await this.muhuratService.getActiveCategories();
        return { success: true, data: categories };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // USER HISTORY ENDPOINTS
  // -------------------------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Post('history')
  @ApiOperation({ summary: 'Save astrology feature history for native user' })
  async saveHistory(@Req() req: any, @Body() dto: SaveAstrologyHistoryDto) {
    try {
      const data = await this.historyService.saveHistory(req.user.userId, dto);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:featureType')
  @ApiOperation({ summary: 'Get astrology feature history for native user' })
  async getHistory(@Req() req: any, @Param('featureType') featureType: string) {
    try {
      const data = await this.historyService.getHistory(req.user.userId, featureType);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('history/:featureType')
  @ApiOperation({ summary: 'Clear astrology feature history for native user' })
  async clearHistory(@Req() req: any, @Param('featureType') featureType: string) {
    try {
      await this.historyService.clearHistory(req.user.userId, featureType);
      return { success: true, message: 'History cleared' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // EDUCATIONAL CONTENT ENDPOINTS (Sequential Lessons)
  // -------------------------------------------------------------------------

  @Get('learning/lessons')
  @ApiOperation({ summary: 'Get all published lessons in order' })
  async getLessons() {
    try {
      const data = await this.contentService.getLessons();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Get('learning/guides')
  @ApiOperation({ summary: 'Get all published lessons (alias)' })
  async getGuides() {
    try {
      const data = await this.contentService.getLessons();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Get('learning/guides/:slug')
  @ApiOperation({ summary: 'Get a specific lesson by slug with adjacent navigation' })
  async getLesson(@Param('slug') slug: string): Promise<any> {
    try {
      const lesson = await this.contentService.getLessonBySlug(slug);
      if (!lesson) throw new Error('Lesson not found');
      const adjacent = await this.contentService.getAdjacentLessons(lesson.order);
      const data = Object.assign({}, lesson, { previousLesson: adjacent.previous, nextLesson: adjacent.next });
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Get('learning/planets')
  @ApiOperation({ summary: 'Get detailed planet profiles' })
  async getPlanets() {
    try {
      const data = await this.contentService.getPlanetProfiles();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Get('learning/planets/:slug')
  async getPlanet(@Param('slug') slug: string) {
    try {
        const planet = await this.contentService.getPlanetBySlug(slug);
        if (!planet) throw new Error('Planet not found');
        return { success: true, data: planet };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('learning/seed')
  @ApiOperation({ summary: 'Seed initial lesson & planet data' })
  async seedContent() {
    try {
      const result = await this.contentService.seedInitialContent();
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // --- ADMIN METHODS ---

  @UseGuards(AdminAuthGuard)
  @Get('admin/learning/guides')
  async getAllLessonsAdmin() {
    return await this.contentService.getAllLessonsAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/learning/guides')
  async upsertLesson(@Body() dto: any) {
    const data = await this.contentService.upsertLesson(dto);
    return { success: true, data };
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/learning/guides/:id')
  async deleteLesson(@Param('id') id: string) {
    await this.contentService.deleteLesson(id);
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/learning/planets')
  async getAllPlanetsAdmin() {
    return await this.contentService.getAllPlanetsAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/learning/planets')
  async upsertPlanet(@Body() dto: any) {
    const data = await this.contentService.upsertPlanet(dto);
    return { success: true, data };
  }

  // --- ADMIN MOON SIGN METHODS ---

  @UseGuards(AdminAuthGuard)
  @Get('admin/moon-signs')
  async getAllMoonSignsAdmin() {
    return await this.contentService.getAllMoonSignsAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/moon-signs/seed')
  async seedMoonSigns() {
    return await this.contentService.seedMoonSigns();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/moon-signs')
  async upsertMoonSign(@Body() dto: any) {
    const data = await this.contentService.upsertMoonSign(dto);
    return { success: true, data };
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/moon-signs/:id')
  async deleteMoonSign(@Param('id') id: string) {
    await this.contentService.deleteMoonSign(id);
    return { success: true };
  }
}
