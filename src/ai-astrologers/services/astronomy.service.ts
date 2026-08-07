import { Injectable, Logger } from '@nestjs/common';
import { exec, execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class AstronomyService {
    private readonly logger = new Logger(AstronomyService.name);
    private readonly scriptPath = path.join(process.cwd(), 'src/ai-astrologers/scripts/astronomy_bridge.py');

    /**
     * Calculate Astrology Data using Python Bridge (Vedic Astronomy)
     * Supports actions: kundli, match, panchang, dasha, all
     */
    async calculateAstrology(action: string, details: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const payload = { action, ...details };
            const inputJson = JSON.stringify(payload);

            const pythonPath = process.platform === 'win32' ? 'python' : 'python3';

            this.logger.debug(`Executing Python Bridge: ${pythonPath} ${this.scriptPath}`);

            const child = execFile(pythonPath, [this.scriptPath, inputJson], (error, stdout, stderr) => {
                if (error) {
                    this.logger.error('Bridge Execution Error:', error);
                    this.logger.error('Stderr:', stderr);
                    return reject(new Error('Failed to execute astronomy bridge'));
                }

                try {
                    const result = JSON.parse(stdout.trim());
                    if (result.status === 'error') {
                        this.logger.error(`Astrology Bridge Data Error: ${result.message}`);
                        return reject(new Error(`Astrology Calculation Error: ${result.message}`));
                    }
                    resolve(result.data);
                } catch (parseError) {
                    this.logger.error('JSON Parse Error:', parseError);
                    this.logger.error('Raw Output:', stdout);
                    reject(new Error('Failed to parse astronomy data'));
                }
            });
        });
    }

    // Helper methods
    async calculatePlanets(date: string, time: string, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        const data = await this.calculateAstrology('kundli', { date, time, lat, lon, tzone });
        return data.planets;
    }

    async calculateHouses(date: string, time: string, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        const data = await this.calculateAstrology('kundli', { date, time, lat, lon, tzone });
        return data.houses;
    }

    async matchHoroscope(boy: any, girl: any, system: string = 'north_indian'): Promise<any> {
        return await this.calculateAstrology('match', { boy, girl, system });
    }

    async getPanchang(date: string, time: string, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        return await this.calculateAstrology('panchang', { date, time, lat, lon, tzone });
    }

    async getDasha(date: string, time: string, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        return await this.calculateAstrology('dasha', { date, time, lat, lon, tzone });
    }

    async getTransits(lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        // Get current planetary positions for Gochar (transits)
        const now = new Date();
        const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const data = await this.calculateAstrology('kundli', { date, time, lat, lon, tzone });
        return data.planets; // Return current planetary positions
    }

    async calculateAllData(date: string, time: string, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        return this.calculateAstrology('all', { date, time, lat, lon, tzone });
    }

    async calculateCalendar(year: number, month: number, lat: string, lon: string, tzone: number = 5.5): Promise<any> {
        return await this.calculateAstrology('calendar', { year, month, lat, lon, tzone });
    }

    private readonly panchangCache = new Map<string, { data: any; timestamp: number }>();

    async getTodayPanchang(lat: string, lon: string, tzone: number = 5.5, date?: string): Promise<any> {
        // Create a unique cache key based on location and date
        // Round lat/lon to 2 decimal places to group nearby requests
        const cacheKey = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}_${tzone}_${date || new Date().toISOString().split('T')[0]}`;
        
        const cached = this.panchangCache.get(cacheKey);
        const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
        
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            this.logger.debug(`Returning cached panchang for ${cacheKey}`);
            return cached.data;
        }

        const data = await this.calculateAstrology('today_panchang', { lat, lon, tzone, date });
        
        // Save to cache
        this.panchangCache.set(cacheKey, { data, timestamp: Date.now() });
        
        // Cleanup old cache entries to prevent memory leak (keep size under 1000)
        if (this.panchangCache.size > 1000) {
            const keysToDelete = Array.from(this.panchangCache.keys()).slice(0, 100);
            for (const key of keysToDelete) {
                this.panchangCache.delete(key);
            }
        }
        
        return data;
    }

    async calculateMuhurat(
        category: string,
        startDate: string,
        endDate: string,
        lat: string,
        lon: string,
        tzone: number = 5.5
    ): Promise<any> {
        return await this.calculateAstrology('muhurat', {
            category,
            start_date: startDate,
            end_date: endDate,
            lat,
            lon,
            tzone
        });
    }

    /**
     * Geocode a place name to lat/lon using OpenStreetMap Nominatim API.
     * Returns { lat: number, lon: number }
     */
    async geocodePlaceOfBirth(place: string): Promise<{ lat: number; lon: number }> {
        if (!place || place.trim().length === 0) {
            throw new Error('Place of birth is empty');
        }

        try {
            const encoded = encodeURIComponent(place.trim());
            const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'VaidikTalk-Astrology/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API returned ${response.status}`);
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                throw new Error(`No geocode results for "${place}"`);
            }

            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            this.logger.log(`📍 Geocoded "${place}" → lat=${lat}, lon=${lon}`);
            return { lat, lon };
        } catch (error) {
            this.logger.error(`❌ Geocoding failed for "${place}":`, error.message);
            throw error;
        }
    }
}
