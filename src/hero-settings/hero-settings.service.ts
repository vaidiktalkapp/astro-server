import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HeroSetting } from './schemas/hero-setting.schema';

@Injectable()
export class HeroSettingsService {
  constructor(
    @InjectModel(HeroSetting.name) private heroSettingModel: Model<HeroSetting>,
  ) { }

  async getSettings() {
    let settings = await this.heroSettingModel.findOne();
    if (!settings) {
      settings = await this.heroSettingModel.create({});
    }
    return settings;
  }

  async updateSettings(updateData: any) {
    let settings = await this.heroSettingModel.findOne();
    if (!settings) {
      settings = await this.heroSettingModel.create(updateData);
    } else {
      settings = await this.heroSettingModel.findOneAndUpdate({}, updateData, { new: true });
    }
    return settings;
  }
}
