import { Controller, Post, Body, Inject, forwardRef } from '@nestjs/common';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { ReportRequestDto } from '../dto/report-request.dto';

@Controller('free-reports')
export class FreeReportsController {
    constructor(
        @Inject(forwardRef(() => AstronomyService))
        private readonly astronomyService: AstronomyService
    ) {}

    @Post('kaal-sarp')
    async getKaalSarpReport(@Body() dto: ReportRequestDto) {
        const result = await this.astronomyService.calculateAllData(
            dto.date,
            dto.time,
            String(dto.lat),
            String(dto.lon),
            dto.tzone
        );
        return {
            success: true,
            data: {
                doshas: result.doshas.kalsarp,
                kundli: {
                    planets: result.kundli.planets,
                    houses: result.kundli.houses,
                    ascendant: result.kundli.ascendant,
                },
                input: dto
            }
        };
    }

    @Post('sade-sati')
    async getSadeSatiReport(@Body() dto: ReportRequestDto) {
        const result = await this.astronomyService.calculateAllData(
            dto.date,
            dto.time,
            String(dto.lat),
            String(dto.lon),
            dto.tzone
        );
        return {
            success: true,
            data: {
                sadeSati: result.sade_sati,
                panchang: result.panchang,
                input: dto
            }
        };
    }

    @Post('gemstone')
    async getGemstoneReport(@Body() dto: ReportRequestDto) {
        const result = await this.astronomyService.calculateAllData(
            dto.date,
            dto.time,
            String(dto.lat),
            String(dto.lon),
            dto.tzone
        );
        return {
            success: true,
            data: {
                gemstones: result.gemstones,
                input: dto
            }
        };
    }

    @Post('manglik')
    async getManglikReport(@Body() dto: ReportRequestDto) {
        const result = await this.astronomyService.calculateAllData(
            dto.date,
            dto.time,
            String(dto.lat),
            String(dto.lon),
            dto.tzone
        );
        return {
            success: true,
            data: {
                manglik: result.doshas.manglik,
                input: dto
            }
        };
    }
}
