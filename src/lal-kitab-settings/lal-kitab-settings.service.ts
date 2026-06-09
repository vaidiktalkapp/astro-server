import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LalKitabSettings } from './schemas/lal-kitab-settings.schema';
import { UpdateLalKitabSettingsDto } from './dto/update-lal-kitab-settings.dto';

@Injectable()
export class LalKitabSettingsService {
  private readonly logger = new Logger(LalKitabSettingsService.name);

  constructor(
    @InjectModel(LalKitabSettings.name) private settingsModel: Model<LalKitabSettings>,
  ) {}

  async getSettings(): Promise<LalKitabSettings> {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = await this.settingsModel.create({});
    }
    return settings;
  }

  async updateSettings(dto: UpdateLalKitabSettingsDto): Promise<LalKitabSettings> {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = new this.settingsModel({});
    }

    Object.assign(settings, dto);
    settings.updatedAt = new Date();
    
    return await settings.save();
  }

  /**
   * Internal method for AI Engine to get merged data
   */
  async getOverrides(): Promise<any> {
    const settings = await this.getSettings();
    return {
      planetOverrides: settings.planetOverrides || {},
      lifeAreaRemedies: settings.lifeAreaRemedies || [],
      generalRules: settings.generalRules || [],
      systemPrompts: settings.systemPrompts || {}
    };
  }
}
