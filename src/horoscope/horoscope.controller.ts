import { Controller, Get, Post, Body, Delete, Param, Query, UseGuards, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HoroscopeService } from './horoscope.service';
import { AdminAuthGuard } from '../admin/core/guards/admin-auth.guard';

@ApiTags('Horoscope Admin')
@Controller('admin/horoscope')
@UseGuards(AdminAuthGuard)
export class HoroscopeController {

  constructor(private readonly horoscopeService: HoroscopeService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a manual love horoscope override' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  async create(@Body() dto: any) {
    try {
        const result = await this.horoscopeService.upsertHoroscope(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all manual horoscope overrides' })
  async findAll() {
    try {
        const result = await this.horoscopeService.findAll();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if a manual override exists' })
  async check(
    @Query('sign') sign: string,
    @Query('period') period: string,
    @Query('date') date: string
  ) {
    try {
        const result = await this.horoscopeService.getManualOverride(sign, period, date);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a manual horoscope override' })
  async delete(@Param('id') id: string) {
    try {
        const result = await this.horoscopeService.delete(id);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // CHINESE HOROSCOPE ADMIN
  // -------------------------------------------------------------------------

  @Post('chinese')
  @ApiOperation({ summary: 'Create or update a manual Chinese horoscope override' })
  async createChinese(@Body() dto: any) {
    try {
        const result = await this.horoscopeService.upsertChineseHoroscope(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('chinese')
  @ApiOperation({ summary: 'List all manual Chinese horoscope overrides' })
  async findAllChinese() {
    try {
        const result = await this.horoscopeService.findAllChineseHoroscopes();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Delete('chinese/:id')
  @ApiOperation({ summary: 'Delete a manual Chinese horoscope override' })
  async deleteChinese(@Param('id') id: string) {
    try {
        const result = await this.horoscopeService.deleteChineseHoroscope(id);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('chinese/profiles')
  @ApiOperation({ summary: 'Update a Chinese Zodiac animal profile' })
  async upsertProfile(@Body() dto: any) {
    try {
        const result = await this.horoscopeService.upsertChineseZodiacProfile(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('chinese/profiles')
  @ApiOperation({ summary: 'List all Chinese Zodiac animal profiles' })
  async findAllProfiles() {
    try {
        const result = await this.horoscopeService.findAllChineseProfiles();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }
  // -------------------------------------------------------------------------
  // WESTERN ZODIAC PROFILES
  // -------------------------------------------------------------------------

  @Post('profiles')
  @ApiOperation({ summary: 'Update a Western Zodiac profile' })
  async upsertZodiacProfile(@Body() dto: any) {
    try {
        const result = await this.horoscopeService.upsertZodiacProfile(dto);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List all Western Zodiac profiles' })
  async findAllZodiacProfiles() {
    try {
        const result = await this.horoscopeService.findAllZodiacProfiles();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }
}
