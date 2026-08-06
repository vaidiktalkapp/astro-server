import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManualHoroscope } from '../schemas/manual-horoscope.schema';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/manual-horoscopes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ManualHoroscopeController {
    constructor(
        @InjectModel(ManualHoroscope.name) private readonly manualHoroscopeModel: Model<ManualHoroscope>
    ) {}

    // List all overrides for a given period and dateIdentifier
    @Get('list')
    async listOverrides(
        @Query('period') period: string,
        @Query('dateIdentifier') dateIdentifier: string
    ) {
        if (!period || !dateIdentifier) {
            return { success: false, message: 'Missing required query parameters' };
        }

        const data = await this.manualHoroscopeModel.find({
            period: period.toLowerCase(),
            dateIdentifier
        }).select('sign language').exec();

        return { success: true, data };
    }

    // Get a specific override
    @Get()
    async getOverride(
        @Query('period') period: string,
        @Query('language') language: string,
        @Query('sign') sign: string,
        @Query('dateIdentifier') dateIdentifier: string
    ) {
        if (!period || !language || !sign || !dateIdentifier) {
            return { success: false, message: 'Missing required query parameters' };
        }

        const data = await this.manualHoroscopeModel.findOne({
            period: period.toLowerCase(),
            language: language.toLowerCase(),
            sign: sign.toLowerCase(),
            dateIdentifier
        }).exec();

        return { success: true, data };
    }

    // Save or update an override
    @Post()
    async saveOverride(@Body() body: any) {
        const { period, language, sign, dateIdentifier, readingData } = body;
        
        if (!period || !language || !sign || !dateIdentifier || !readingData) {
            return { success: false, message: 'Missing required fields' };
        }

        const data = await this.manualHoroscopeModel.findOneAndUpdate(
            {
                period: period.toLowerCase(),
                language: language.toLowerCase(),
                sign: sign.toLowerCase(),
                dateIdentifier
            },
            { readingData },
            { upsert: true, new: true }
        ).exec();

        return { success: true, data };
    }

    // Delete an override
    @Delete()
    async deleteOverride(
        @Query('period') period: string,
        @Query('language') language: string,
        @Query('sign') sign: string,
        @Query('dateIdentifier') dateIdentifier: string
    ) {
        await this.manualHoroscopeModel.findOneAndDelete({
            period: period.toLowerCase(),
            language: language.toLowerCase(),
            sign: sign.toLowerCase(),
            dateIdentifier
        }).exec();

        return { success: true };
    }
}
