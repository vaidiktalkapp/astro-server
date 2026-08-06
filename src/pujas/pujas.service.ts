import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Puja, PujaDocument } from './schemas/puja.schema';
import { CreatePujaDto } from './dto/create-puja.dto';

@Injectable()
export class PujasService {
  constructor(@InjectModel(Puja.name) private pujaModel: Model<PujaDocument>) {}

  async create(createPujaDto: CreatePujaDto): Promise<Puja> {
    try {
      const createdPuja = new this.pujaModel(createPujaDto);
      return await createdPuja.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Puja with this slug already exists.');
      }
      throw error;
    }
  }

  async findAll(query: any = {}): Promise<{ data: Puja[], total: number }> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.popular !== undefined) filter.popular = query.popular === 'true' || query.popular === true;

    const limit = query.limit ? parseInt(query.limit) : 50;
    const page = query.page ? parseInt(query.page) : 1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.pujaModel.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.pujaModel.countDocuments(filter)
    ]);

    return { data, total };
  }

  async findOne(idOrSlug: string): Promise<Puja> {
    let puja;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      puja = await this.pujaModel.findById(idOrSlug).exec();
    }
    if (!puja) {
      puja = await this.pujaModel.findOne({ slug: idOrSlug }).exec();
    }
    if (!puja) {
      throw new NotFoundException(`Puja with identifier ${idOrSlug} not found`);
    }
    return puja;
  }

  async update(id: string, updatePujaDto: Partial<CreatePujaDto>): Promise<Puja> {
    try {
      const updatedPuja = await this.pujaModel.findByIdAndUpdate(id, updatePujaDto, { new: true }).exec();
      if (!updatedPuja) {
        throw new NotFoundException(`Puja with ID ${id} not found`);
      }
      return updatedPuja;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Puja with this slug already exists.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<any> {
    const deletedPuja = await this.pujaModel.findByIdAndDelete(id).exec();
    if (!deletedPuja) {
      throw new NotFoundException(`Puja with ID ${id} not found`);
    }
    return { success: true, message: 'Puja deleted successfully' };
  }
}
