import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner } from './schemas/banner.schema';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<Banner>,
  ) {}

  async create(createData: any): Promise<Banner> {
    const createdBanner = new this.bannerModel(createData);
    return createdBanner.save();
  }

  async findAll(query: any = {}): Promise<Banner[]> {
    return this.bannerModel.find(query).sort({ order: 1, createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException(`Banner #${id} not found`);
    }
    return banner;
  }

  async update(id: string, updateData: any): Promise<Banner> {
    const existingBanner = await this.bannerModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    ).exec();
    
    if (!existingBanner) {
      throw new NotFoundException(`Banner #${id} not found`);
    }
    return existingBanner;
  }

  async remove(id: string): Promise<any> {
    const banner = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!banner) {
      throw new NotFoundException(`Banner #${id} not found`);
    }
    return { success: true, message: 'Banner deleted successfully' };
  }
}
