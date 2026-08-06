import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Testimonial, TestimonialDocument } from './schemas/testimonial.schema';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name) private testimonialModel: Model<TestimonialDocument>
  ) {}

  // Extract video ID from youtube link
  private extractVideoId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})/);
    return (match && match[1]) ? match[1] : null;
  }

  async findAllActive(category?: string): Promise<Testimonial[]> {
    const filter: any = { isActive: true };
    if (category) filter.category = category;
    return this.testimonialModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findAllForAdmin(category?: string): Promise<Testimonial[]> {
    const filter: any = {};
    if (category) filter.category = category;
    return this.testimonialModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async create(data: any): Promise<Testimonial> {
    const count = await this.testimonialModel.countDocuments();
    if (count >= 10) {
      const { BadRequestException } = require('@nestjs/common');
      throw new BadRequestException('Maximum limit of 10 testimonials reached. Please delete an existing one to add a new video.');
    }
    const videoId = data.youtubeLink ? this.extractVideoId(data.youtubeLink) : null;
    const newTestimonial = new this.testimonialModel({ ...data, videoId });
    return newTestimonial.save();
  }

  async update(id: string, data: any): Promise<Testimonial> {
    const updateData = { ...data };
    if (updateData.youtubeLink) {
      updateData.videoId = this.extractVideoId(updateData.youtubeLink);
    }
    const updated = await this.testimonialModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException(`Testimonial with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<any> {
    const deleted = await this.testimonialModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Testimonial with ID ${id} not found`);
    }
    return { success: true, message: 'Testimonial deleted successfully' };
  }
}
