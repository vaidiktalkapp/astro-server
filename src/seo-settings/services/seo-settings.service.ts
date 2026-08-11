import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SeoSetting, SeoSettingDocument } from '../schemas/seo-setting.schema';
import { UpdateSeoSettingsDto } from '../dto/update-seo-settings.dto';

@Injectable()
export class SeoSettingsService {
  constructor(
    @InjectModel(SeoSetting.name) private seoSettingModel: Model<SeoSettingDocument>,
  ) {}

  async getSettings(): Promise<SeoSettingDocument> {
    let settings = await this.seoSettingModel.findOne();
    if (!settings) {
      settings = await this.seoSettingModel.create({});
    }
    return settings;
  }

  async updateSettings(updateDto: UpdateSeoSettingsDto): Promise<SeoSettingDocument> {
    const settings = await this.getSettings();
    
    if (updateDto.robotsTxtContent !== undefined) {
      settings.robotsTxtContent = updateDto.robotsTxtContent;
    }
    if (updateDto.additionalSitemapUrls !== undefined) {
      settings.additionalSitemapUrls = updateDto.additionalSitemapUrls;
    }

    return settings.save();
  }
}
