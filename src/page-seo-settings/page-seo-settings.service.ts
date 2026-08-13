import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageSeoSetting, PageSeoSettingDocument } from './schemas/page-seo-setting.schema';
import { CreatePageSeoSettingDto } from './dto/create-page-seo-setting.dto';

@Injectable()
export class PageSeoSettingsService {
  constructor(
    @InjectModel(PageSeoSetting.name)
    private readonly model: Model<PageSeoSettingDocument>,
  ) {}

  async createOrUpdate(dto: CreatePageSeoSettingDto): Promise<PageSeoSetting> {
    return this.model.findOneAndUpdate(
      { pageSlug: dto.pageSlug },
      { $set: dto },
      { new: true, upsert: true }
    ).exec();
  }

  async findAll(): Promise<PageSeoSetting[]> {
    return this.model.find().sort({ updatedAt: -1 }).exec();
  }

  async findBySlug(pageSlug: string): Promise<PageSeoSetting> {
    // Allows matching exact slug, ignoring leading/trailing slashes if passed incorrectly
    const normalizedSlug = pageSlug.replace(/^\/+|\/+$/g, '');
    const setting = await this.model.findOne({ pageSlug: normalizedSlug }).exec();
    if (!setting) {
      throw new NotFoundException(`SEO settings for slug '${normalizedSlug}' not found`);
    }
    return setting;
  }

  async remove(id: string): Promise<any> {
    return this.model.findByIdAndDelete(id).exec();
  }
}
