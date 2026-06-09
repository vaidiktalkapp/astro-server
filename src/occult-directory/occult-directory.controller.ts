import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OccultDirectoryService } from './occult-directory.service';
import { UpdateDirectorySettingsDto } from './dto/update-directory-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('occult-directory')
export class OccultDirectoryController {
  constructor(private readonly directoryService: OccultDirectoryService) {}

  @Get('settings')
  async getSettings() {
    const settings = await this.directoryService.getSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Get('expertise/:city')
  async getExpertiseByCity(@Param('city') city: string) {
    const expertise = await this.directoryService.getExpertiseByCity(city);
    return {
      success: true,
      data: expertise,
    };
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSettings(@Body() updateDto: UpdateDirectorySettingsDto) {
    const settings = await this.directoryService.updateSettings(updateDto);
    return {
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    };
  }

  // Cities Management
  @Post('cities')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addCity(@Body('city') city: string) {
    const settings = await this.directoryService.addCity(city);
    return {
      success: true,
      data: settings,
      message: 'City added successfully',
    };
  }

  @Delete('cities/:city')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeCity(@Param('city') city: string) {
    const settings = await this.directoryService.removeCity(city);
    return {
      success: true,
      data: settings,
      message: 'City removed successfully',
    };
  }

  @Post('cities/:city/expertise')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateCityExpertise(
    @Param('city') city: string,
    @Body('expertise') expertise: string[]
  ) {
    const settings = await this.directoryService.updateCityExpertise(city, expertise);
    return {
      success: true,
      data: settings,
      message: `Expertise updated for ${city}`,
    };
  }

  // Popular Cities Management
  @Post('popular-cities')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addPopularCity(@Body('city') city: string) {
    const settings = await this.directoryService.addPopularCity(city);
    return {
      success: true,
      data: settings,
      message: 'Popular city added successfully',
    };
  }

  @Post('cities/:city/toggle-popular')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async togglePopularCity(@Param('city') city: string) {
    const settings = await this.directoryService.togglePopularCity(city);
    return {
      success: true,
      data: settings,
      message: 'City status updated successfully',
    };
  }

  @Delete('popular-cities/:city')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removePopularCity(@Param('city') city: string) {
    const settings = await this.directoryService.removePopularCity(city);
    return {
      success: true,
      data: settings,
      message: 'Popular city removed successfully',
    };
  }

  // Expertise Management
  @Post('expertise')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addExpertise(@Body('expertise') expertise: string) {
    const settings = await this.directoryService.addExpertise(expertise);
    return {
      success: true,
      data: settings,
      message: 'Expertise added successfully',
    };
  }

  @Delete('expertise/:expertise')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeExpertise(@Param('expertise') expertise: string) {
    const settings = await this.directoryService.removeExpertise(expertise);
    return {
      success: true,
      data: settings,
      message: 'Expertise removed successfully',
    };
  }

  // Languages Management
  @Post('languages')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addLanguage(@Body('language') language: string) {
    const settings = await this.directoryService.addLanguage(language);
    return {
      success: true,
      data: settings,
      message: 'Language added successfully',
    };
  }

  @Delete('languages/:language')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeLanguage(@Param('language') language: string) {
    const settings = await this.directoryService.removeLanguage(language);
    return {
      success: true,
      data: settings,
      message: 'Language removed successfully',
    };
  }
}
