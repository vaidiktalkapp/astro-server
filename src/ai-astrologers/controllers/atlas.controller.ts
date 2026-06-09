import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AstronomyService } from '../services/astronomy.service';

@Controller('atlas')
export class AtlasController {
    private readonly logger = new Logger(AtlasController.name);

    constructor(private readonly astronomyService: AstronomyService) {}

    @Get('geocode')
    async geocode(@Query('q') q: string) {
        if (!q || q.trim().length === 0) {
            throw new HttpException('City name is required', HttpStatus.BAD_REQUEST);
        }

        try {
            this.logger.log(`Atlas Search: Querying coordinates for "${q}"`);
            
            // Reusing the robust geocoding method from AstronomyService
            // This uses Nominatim OpenStreetMap API
            const result = await this.astronomyService.geocodePlaceOfBirth(q);
            
            return {
                success: true,
                data: {
                    name: q,
                    ...result
                }
            };
        } catch (error) {
            this.logger.error(`Atlas Search Failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Location not found', 
                HttpStatus.NOT_FOUND
            );
        }
    }
}
