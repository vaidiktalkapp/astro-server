import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Faq, FaqDocument } from './schemas/faq.schema';
import { CreateFaqDto } from './dto/create-faq.dto';

@Injectable()
export class FaqsService {
  constructor(@InjectModel(Faq.name) private faqModel: Model<FaqDocument>) {}

  async create(createFaqDto: CreateFaqDto): Promise<Faq> {
    const createdFaq = new this.faqModel(createFaqDto);
    return createdFaq.save();
  }

  async findAll(query: any = {}): Promise<{ data: Faq[], total: number }> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;

    const limit = query.limit ? parseInt(query.limit) : 50;
    const page = query.page ? parseInt(query.page) : 1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.faqModel.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.faqModel.countDocuments(filter)
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Faq> {
    const faq = await this.faqModel.findById(id).exec();
    if (!faq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }
    return faq;
  }

  async update(id: string, updateFaqDto: Partial<CreateFaqDto>): Promise<Faq> {
    const updatedFaq = await this.faqModel.findByIdAndUpdate(id, updateFaqDto, { new: true }).exec();
    if (!updatedFaq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }
    return updatedFaq;
  }

  async remove(id: string): Promise<any> {
    const deletedFaq = await this.faqModel.findByIdAndDelete(id).exec();
    if (!deletedFaq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }
    return { success: true, message: 'FAQ deleted successfully' };
  }
}
