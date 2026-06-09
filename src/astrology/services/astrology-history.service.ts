import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AstrologyHistory, AstrologyHistoryDocument } from '../schemas/astrology-history.schema';
import { SaveAstrologyHistoryDto } from '../dto/astrology-history.dto';

@Injectable()
export class AstrologyHistoryService {
  constructor(
    @InjectModel(AstrologyHistory.name) private historyModel: Model<AstrologyHistoryDocument>,
  ) {}

  async saveHistory(userId: string, dto: SaveAstrologyHistoryDto) {
    try {
      // 1. Define criteria for "duplicate" detection based on feature type
      // We look for same user, same feature, and same core input (name/date)
      const query: any = { userId, featureType: dto.featureType };
      
      // Extract identifying details from the payload data
      const input = dto.data.input || dto.data;
      if (input.name) query['data.input.name'] = input.name;
      if (input.date) query['data.input.date'] = input.date;
      
      // For horoscope matching, check both partners
      if (dto.featureType === 'horoscope-matching') {
          const boy = input.boy || input.boyRecord;
          const girl = input.girl || input.girlRecord;
          if (boy?.name) query['data.boy.name'] = boy.name;
          if (girl?.name) query['data.girl.name'] = girl.name;
          if (boy?.date) query['data.boy.date'] = boy.date;
          if (girl?.date) query['data.girl.date'] = girl.date;
      }

      // 2. Upsert the history entry
      // This will update the existing record (and its updatedAt/createdAt) 
      // or create a new one if it doesn't match criteria.
      const updatedEntry = await this.historyModel.findOneAndUpdate(
        query,
        { 
          $set: { 
            data: dto.data,
            updatedAt: new Date() // Force refresh for sorting
          } 
        },
        { 
          new: true, 
          upsert: true,
          setDefaultsOnInsert: true 
        }
      );

      // 3. Keep only the last 50 entries per user per feature
      const count = await this.historyModel.countDocuments({ userId, featureType: dto.featureType });
      if (count > 50) {
        const oldestDocs = await this.historyModel
          .find({ userId, featureType: dto.featureType })
          .sort({ updatedAt: 1 }) // Delete oldest by last update
          .limit(count - 50)
          .select('_id');

        await this.historyModel.deleteMany({ _id: { $in: oldestDocs.map(d => d._id) } });
      }

      return updatedEntry;
    } catch (error) {
      console.error('Error saving history:', error);
      throw new InternalServerErrorException('Failed to save history');
    }
  }

  async getHistory(userId: string, featureType: string) {
    try {
      // Return sorted by newest first
      return await this.historyModel
        .find({ userId, featureType })
        .sort({ createdAt: -1 })
        .select('-userId -__v'); // Exclude sensitive/internal fields
    } catch (error) {
      console.error('Error fetching history:', error);
      throw new InternalServerErrorException('Failed to fetch history');
    }
  }

  // Allow clearing history completely per feature
  async clearHistory(userId: string, featureType: string): Promise<any> {
      return await this.historyModel.deleteMany({ userId, featureType });
  }
}
