import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HealingItem, HealingItemDocument } from './schemas/healing-item.schema';

@Injectable()
export class HealingService {
  constructor(
    @InjectModel(HealingItem.name)
    private healingItemModel: Model<HealingItemDocument>,
  ) {}

  // --- Public Methods ---

  async findAll(type?: string): Promise<HealingItem[]> {
    const query = { isActive: true, status: 'Published' };
    if (type) {
      query['type'] = type;
    }
    return this.healingItemModel.find(query).sort({ order: 1 }).exec();
  }

  async findBySlug(slug: string): Promise<HealingItem> {
    const item = await this.healingItemModel.findOne({ slug, isActive: true }).exec();
    if (!item) {
      throw new NotFoundException(`Healing item with slug ${slug} not found`);
    }
    return item;
  }

  // --- Admin Methods ---

  async adminFindAll(type?: string): Promise<HealingItem[]> {
    const query = {};
    if (type) {
      query['type'] = type;
    }
    return this.healingItemModel.find(query).sort({ order: 1 }).exec();
  }

  async upsert(data: any): Promise<HealingItem> {
    if (data._id) {
      const updated = await this.healingItemModel
        .findByIdAndUpdate(data._id, data, { new: true })
        .exec();
      if (!updated) throw new NotFoundException(`Healing item ${data._id} not found`);
      return updated;
    }
    return new this.healingItemModel(data).save();
  }

  async delete(id: string): Promise<any> {
    return this.healingItemModel.findByIdAndDelete(id).exec();
  }

  async seed(items: any[]): Promise<void> {
    for (const item of items) {
      await this.healingItemModel.updateOne(
        { slug: item.slug },
        { $set: item },
        { upsert: true },
      );
    }
  }
}
