import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MuhuratCategory, MuhuratCategoryDocument } from '../schemas/muhurat-category.schema';
import { MuhuratManualDate, MuhuratManualDateDocument } from '../schemas/muhurat-date.schema';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { AiAstrologyEngineService } from '../../ai-astrologers/services/ai-astrology-engine.service';

@Injectable()
export class MuhuratService {
  private readonly logger = new Logger(MuhuratService.name);

  constructor(
    @InjectModel(MuhuratCategory.name) private categoryModel: Model<MuhuratCategoryDocument>,
    @InjectModel(MuhuratManualDate.name) private dateModel: Model<MuhuratManualDateDocument>,
    private readonly astronomyService: AstronomyService,
    // Use forwardRef to avoid circular dependency if AiAstrologyEngineService also needs this service
    @Inject(forwardRef(() => AiAstrologyEngineService))
    private readonly aiEngineService: AiAstrologyEngineService,
  ) {}

  /**
   * Main calculation method that merges Manual Overrides (Admin) with Dynamic AI (Python Engine).
   */
  async calculateMuhuratMerged(
    category: string,
    startDate: string,
    endDate: string,
    lat: number,
    lon: number,
    tzone: number = 5.5,
    language: string = 'English'
  ): Promise<any> {
    try {
        this.logger.log(`🔍 Calculating merged Muhurat for ${category} (${startDate} to ${endDate})`);

        // 1. Fetch Category Config (Check if it exists in DB)
        const catConfig = await this.categoryModel.findOne({ 
            $or: [
                { slug: { $regex: new RegExp(`^${category}$`, 'i') } },
                { name: { $regex: new RegExp(`^${category}$`, 'i') } }
            ] 
        });

        this.logger.log(`Found catConfig: ${catConfig ? catConfig.name : 'NULL'} for category: ${category}`);

        // 2. Fetch Manual Overrides from DB
        const manualDates = await this.dateModel.find({
            categoryId: catConfig ? catConfig._id : null,
            date: { $gte: startDate, $lte: endDate }
        }).lean();

        // 3. Fetch Dynamic Results from Python Engine
        const dynamicResult = await this.astronomyService.calculateMuhurat(
            category,
            startDate,
            endDate,
            String(lat),
            String(lon),
            tzone
        );

        // 4. Merge Logic: Overrides Take Priority
        let auspiciousDates = dynamicResult.auspicious_dates || [];
        let allDates = dynamicResult.all_dates || dynamicResult.auspicious_dates || [];
        
        // Convert dynamic dates to a map for easy merging
        const auspiciousMap = new Map();
        auspiciousDates.forEach((d: any) => auspiciousMap.set(d.date, d));

        const allMap = new Map();
        allDates.forEach((d: any) => allMap.set(d.date, d));

        // Inject Manual Dates
        for (const m of manualDates) {
            const entry = {
                date: m.date,
                nakshatra: m.nakshatra,
                tithi: m.tithi,
                muhurat_start: m.muhurat_start,
                muhurat_end: m.muhurat_end,
                sun_rise: m.sun_rise,
                sun_set: m.sun_set,
                quality_score: m.quality_score,
                reasons_good: m.reasons_good,
                aiVerdict: m.aiVerdict, // Admin manually provided a verdict
                isFullDay: m.isFullDay,
                is_auspicious: true, // Manual items are assumed auspicious
                isManual: true // Just a flag
            };
            auspiciousMap.set(m.date, entry);
            allMap.set(m.date, entry);
        }

        // 5. Convert Maps back to sorted arrays
        const finalAuspicious = Array.from(auspiciousMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const finalAll = Array.from(allMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        // 6. Generate AI Verdicts for the Top results if missing
        // For performance, we generate for up to 3 results per request in parallel
        await Promise.all(finalAuspicious.slice(0, 3).map(async (d) => {
            if (!d.aiVerdict) {
                try {
                    d.aiVerdict = await this.aiEngineService.generateMuhuratVerdict(
                        catConfig ? catConfig.name : category,
                        {
                            date: d.date,
                            tithi: d.tithi,
                            nakshatra: d.nakshatra,
                            yoga: d.yoga || 'Strong Yoga',
                            karana: d.karana || 'Auspicious Karana',
                            muhurat_start: d.muhurat_start,
                            muhurat_end: d.muhurat_end
                        },
                        catConfig?.aiPrompt,
                        language
                    );
                } catch (err) {
                    this.logger.error(`Error generating AI verdict for ${d.date}:`, err.message);
                }
            }
        }));

        return {
            ...dynamicResult,
            auspicious_dates: finalAuspicious,
            all_dates: finalAll
        };

    } catch (error: any) {
        this.logger.error('Error in calculateMuhuratMerged:', error.message);
        throw error;
    }
  }

  /**
   * Public Category list for the frontend
   */
  async getActiveCategories() {
    return await this.categoryModel.find({ isActive: true }).sort({ name: 1 });
  }
}
