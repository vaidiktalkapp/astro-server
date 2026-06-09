import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompatibilitySettings } from './schemas/compatibility-settings.schema';
import { UpdateCompatibilitySettingsDto } from './dto/update-compatibility-settings.dto';

@Injectable()
export class CompatibilitySettingsService {
  constructor(
    @InjectModel(CompatibilitySettings.name) private compatibilitySettingsModel: Model<CompatibilitySettings>,
  ) { }

  async getSettings(): Promise<CompatibilitySettings> {
    let settings = await this.compatibilitySettingsModel.findOne().exec();

    if (!settings) {
      settings = await this.compatibilitySettingsModel.create({});
    }

    return settings;
  }

  async updateSettings(updateDto: UpdateCompatibilitySettingsDto): Promise<CompatibilitySettings> {
    let settings = await this.compatibilitySettingsModel.findOne().exec();

    if (!settings) {
      settings = await this.compatibilitySettingsModel.create(updateDto);
    } else {
      if (updateDto.pairInsights !== undefined) settings.pairInsights = updateDto.pairInsights;
      if (updateDto.elementInsights !== undefined) settings.elementInsights = updateDto.elementInsights;
      if (updateDto.archetypes !== undefined) settings.archetypes = updateDto.archetypes;
      if (updateDto.numerologyPairInsights !== undefined) settings.numerologyPairInsights = updateDto.numerologyPairInsights;
      if (updateDto.numerologyScores !== undefined) settings.numerologyScores = updateDto.numerologyScores;
      if (updateDto.numerologyChallenges !== undefined) settings.numerologyChallenges = updateDto.numerologyChallenges;
      settings.updatedAt = new Date();
      settings.markModified('pairInsights');
      settings.markModified('elementInsights');
      settings.markModified('archetypes');
      settings.markModified('numerologyPairInsights');
      settings.markModified('numerologyScores');
      settings.markModified('numerologyChallenges');
      await settings.save();
    }

    return settings;
  }
}
