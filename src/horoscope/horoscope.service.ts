import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoveHoroscope } from './schemas/love-horoscope.schema';
import { LoveHoroscopeCache } from './schemas/love-horoscope-cache.schema';
import { ZodiacProfile } from './schemas/zodiac-profile.schema';
import { ChineseZodiacProfile } from './schemas/chinese-zodiac-profile.schema';
import { ChineseHoroscope } from './schemas/chinese-horoscope.schema';
import { ChineseHoroscopeCache } from './schemas/chinese-horoscope-cache.schema';

@Injectable()
export class HoroscopeService {
  private readonly logger = new Logger(HoroscopeService.name);

  constructor(
    @InjectModel('LoveHoroscope') private readonly horoscopeModel: Model<LoveHoroscope>,
    @InjectModel('LoveHoroscopeCache') private readonly cacheModel: Model<LoveHoroscopeCache>,
    @InjectModel('ZodiacProfile') private readonly zodiacProfileModel: Model<ZodiacProfile>,
    @InjectModel('ChineseZodiacProfile') private readonly chineseProfileModel: Model<ChineseZodiacProfile>,
    @InjectModel('ChineseHoroscope') private readonly chineseHoroscopeModel: Model<ChineseHoroscope>,
    @InjectModel('ChineseHoroscopeCache') private readonly chineseCacheModel: Model<ChineseHoroscopeCache>
  ) {}

  /**
   * Get AI cached horoscope if exists
   */
  async getAiCache(sign: string, period: string, date: string): Promise<any | null> {
    try {
      const entry = await this.cacheModel.findOne({
        sign: sign.toLowerCase(),
        period: period.toLowerCase(),
        targetDate: date,
        isActive: true
      }).exec();

      if (!entry) return null;
      return this.mapEntryToResponse(entry, 'ai-cache');
    } catch (error) {
      return null;
    }
  }

  /**
   * Save AI result to cache
   */
  async setAiCache(data: any): Promise<void> {
    try {
      const { sign, period, targetDate } = data;
      await this.cacheModel.findOneAndUpdate(
        { sign: sign.toLowerCase(), period: period.toLowerCase(), targetDate },
        { 
          ...data, 
          sign: sign.toLowerCase(), 
          period: period.toLowerCase(),
          loveScore: data.vibeScore || data.loveScore // Handle both naming conventions
        },
        { upsert: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Error saving to AI cache: ${error.message}`);
    }
  }

  /**
   * Get manual horoscope override if exists
   */
  async getManualOverride(sign: string, period: string, date: string): Promise<any | null> {
    try {
      const p = period.toLowerCase();
      
      let query: any = {
        sign: sign.toLowerCase(),
        period: p,
        isActive: true
      };

      if (p === 'weekly') {
        // Find the most recent weekly entry that is NOT older than 7 days from the requested date
        // AND its targetDate is <= the requested date
        query.targetDate = { $lte: date };
        const entries = await this.horoscopeModel.find(query).sort({ targetDate: -1 }).limit(1).exec();
        const entry = entries[0];
        
        if (!entry) return null;

        // Check if it's within 7 days
        const entryTs = new Date(entry.targetDate).getTime();
        const requestedTs = new Date(date).getTime();
        const diffDays = (requestedTs - entryTs) / (1000 * 3600 * 24);
        
        if (diffDays >= 0 && diffDays < 7) {
          return this.mapEntryToResponse(entry);
        }
        return null;
      }

      // For Daily and Tomorrow, use exact date match
      const entry = await this.horoscopeModel.findOne({
        ...query,
        targetDate: date
      }).exec();

      if (!entry) return null;
      return this.mapEntryToResponse(entry);
    } catch (error) {
      this.logger.error(`Error fetching manual override: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper to map DB entry to response format
   */
  public mapEntryToResponse(entry: any, source: string = 'manual') {
    return {
      sign: entry.sign,
      period: entry.period,
      todayDate: entry.targetDate,
      vibeScore: entry.loveScore,
      vibeName: entry.vibeName,
      sections: [
        { title: "Love Life Overview", content: entry.prediction },
        { title: "For Committed Relationships", content: entry.forCouples },
        { title: "For Singles", content: entry.forSingles }
      ],
      relationshipAdvice: {
        title: "Divine Relationship Tip",
        content: entry.relationshipAdvice
      },
      luckyElements: {
        color: entry.luckyColor,
        time: entry.luckyTime,
        number: entry.luckyNumber
      },
      source
    };
  }

  /**
   * Save or Update a manual horoscope
   */
  async upsertHoroscope(data: any): Promise<LoveHoroscope> {
    const { sign, period, targetDate } = data;
    
    return this.horoscopeModel.findOneAndUpdate(
      { sign: sign.toLowerCase(), period: period.toLowerCase(), targetDate },
      { ...data, sign: sign.toLowerCase(), period: period.toLowerCase() },
      { upsert: true, new: true }
    ).exec();
  }

  /**
   * List all manual overrides (for Admin view)
   */
  async findAll(): Promise<LoveHoroscope[]> {
    return this.horoscopeModel.find().sort({ targetDate: -1 }).exec();
  }

  /**
   * Delete an override
   */
  async delete(id: string): Promise<any> {
    return this.horoscopeModel.findByIdAndDelete(id).exec();
  }

  // -------------------------------------------------------------------------
  // WESTERN ZODIAC PROFILES
  // -------------------------------------------------------------------------

  async getZodiacProfile(sign: string): Promise<ZodiacProfile | null> {
    return this.zodiacProfileModel.findOne({ sign: new RegExp(`^${sign}$`, 'i') }).exec();
  }

  async upsertZodiacProfile(data: any): Promise<ZodiacProfile> {
    return this.zodiacProfileModel.findOneAndUpdate(
      { sign: data.sign },
      { ...data },
      { upsert: true, new: true }
    ).exec();
  }

  async findAllZodiacProfiles(): Promise<ZodiacProfile[]> {
    return this.zodiacProfileModel.find().exec();
  }

  // -------------------------------------------------------------------------
  // CHINESE ZODIAC METHODS
  // -------------------------------------------------------------------------

  /**
   * CHINESE: Get AI cached horoscope
   */
  async getChineseAiCache(sign: string, period: string, date: string): Promise<any | null> {
    try {
      const entry = await this.chineseCacheModel.findOne({
        sign: sign.toLowerCase(),
        period: period.toLowerCase(),
        targetDate: date,
        isActive: true
      }).exec();

      if (!entry) return null;
      return this.transformChineseResponse(entry, 'ai-cache');
    } catch (error) {
      return null;
    }
  }

  /**
   * CHINESE: Save AI result to cache
   */
  async setChineseAiCache(data: any): Promise<void> {
    try {
      const { sign, period, targetDate } = data;
      await this.chineseCacheModel.findOneAndUpdate(
        { sign: sign.toLowerCase(), period: period.toLowerCase(), targetDate },
        { ...data, sign: sign.toLowerCase(), period: period.toLowerCase() },
        { upsert: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Error saving Chinese AI cache: ${error.message}`);
    }
  }

  /**
   * CHINESE: Get manual override
   */
  async getChineseManualOverride(sign: string, period: string, date: string): Promise<any | null> {
    try {
      const p = period.toLowerCase();
      const entry = await this.chineseHoroscopeModel.findOne({
        sign: sign.toLowerCase(),
        period: p,
        targetDate: date,
        isActive: true
      }).exec();

      if (!entry) return null;
      return this.transformChineseResponse(entry);
    } catch (error) {
      return null;
    }
  }

  /**
   * CHINESE: Map DB entry to response
   */
  /**
   * Universal mapper to convert DB entry (flat) or AI RAW (flat) to Frontend-friendly structure
   */
  public transformChineseResponse(entry: any, source: string = 'manual') {
    // If the entry already has the new 'fullReading' or JOINED prediction, use it
    let unifiedReading = entry.fullReading || entry.prediction;

    // Fallback: If it's an old manual override with split fields, join them
    if (!unifiedReading && (entry.forRelationships || entry.forSingles || entry.careerInsight)) {
      unifiedReading = [
        entry.forRelationships,
        entry.forSingles,
        entry.careerInsight
      ].filter(Boolean).join(' ');
    }

    return {
      sign: entry.sign,
      period: entry.period,
      todayDate: entry.targetDate || entry.todayDate,
      vibeScore: entry.vibeScore || entry.loveScore || 70,
      vibeName: entry.vibeName || 'Harmony',
      prediction: unifiedReading || 'General guidance pending...',
      luckyElements: {
        color: entry.luckyColor || (entry.luckyElements?.color) || 'Gold',
        time: entry.luckyTime || (entry.luckyElements?.time) || 'Morning',
        number: entry.luckyNumber || (entry.luckyElements?.number) || '8'
      },
      source
    };
  }

  /**
   * CHINESE PROFILES: For the personality data
   */
  async getChineseZodiacProfile(name: string): Promise<ChineseZodiacProfile | null> {
    return this.chineseProfileModel.findOne({ name: new RegExp(`^${name}$`, 'i') }).exec();
  }

  async upsertChineseZodiacProfile(data: any): Promise<ChineseZodiacProfile> {
    return this.chineseProfileModel.findOneAndUpdate(
      { name: data.name },
      { ...data },
      { upsert: true, new: true }
    ).exec();
  }

  async findAllChineseProfiles(): Promise<ChineseZodiacProfile[]> {
    return this.chineseProfileModel.find().exec();
  }

  /**
   * ADMIN METHODS FOR CHINESE HOROSCOPE
   */
  async upsertChineseHoroscope(data: any): Promise<ChineseHoroscope> {
    const { sign, period, targetDate } = data;
    return this.chineseHoroscopeModel.findOneAndUpdate(
      { sign: sign.toLowerCase(), period: period.toLowerCase(), targetDate },
      { ...data, sign: sign.toLowerCase(), period: period.toLowerCase() },
      { upsert: true, new: true }
    ).exec();
  }

  async findAllChineseHoroscopes(): Promise<ChineseHoroscope[]> {
    return this.chineseHoroscopeModel.find().sort({ targetDate: -1 }).exec();
  }

  async deleteChineseHoroscope(id: string): Promise<any> {
    return this.chineseHoroscopeModel.findByIdAndDelete(id).exec();
  }
}
