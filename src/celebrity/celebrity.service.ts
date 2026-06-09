import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
  import { Celebrity, CelebrityDocument } from './schemas/celebrity.schema';
import { CreateCelebrityDto } from './dto/create-celebrity.dto';
import { AstronomyService } from '../ai-astrologers/services/astronomy.service';

@Injectable()
export class CelebrityService {
  private readonly logger = new Logger(CelebrityService.name);

  constructor(
    @InjectModel(Celebrity.name) private celebrityModel: Model<CelebrityDocument>,
    private readonly astronomyService: AstronomyService,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async create(createCelebrityDto: CreateCelebrityDto): Promise<Celebrity> {
    const slug = createCelebrityDto.slug || this.generateSlug(createCelebrityDto.name);
    
    const existing = await this.celebrityModel.findOne({ slug }).exec();
    if (existing) {
      throw new ConflictException('A celebrity with this slug already exists');
    }

    const created = new this.celebrityModel({
      ...createCelebrityDto,
      slug,
    });
    return created.save();
  }

  async findAll(query: any = {}): Promise<Celebrity[]> {
    return this.celebrityModel.find(query).sort({ name: 1 }).exec();
  }

  async findBySlug(slug: string): Promise<Celebrity> {
    const celebrity = await this.celebrityModel.findOne({ slug, isActive: true }).exec();
    if (!celebrity) {
      throw new NotFoundException('Celebrity not found');
    }

    // --- Caching Logic ---
    if (!celebrity.kundliData) {
      this.logger.log(`🔄 Calculating and caching chart for: ${celebrity.name}`);
      try {
        const kundliData = await this.astronomyService.calculateAllData(
            celebrity.birthDate,
            celebrity.birthTime || '12:00', // Default if missing
            String(celebrity.latitude),
            String(celebrity.longitude),
            celebrity.timezone || 5.5
        );
        
        // Save the calculated data to the document
        celebrity.kundliData = kundliData;
        await (celebrity as any).save();
        this.logger.log(`✅ Cache updated for: ${celebrity.name}`);
      } catch (err) {
        this.logger.error(`❌ Failed to cache chart for ${celebrity.name}:`, err.message);
        // We continue anyway, the frontend might try to calculate it as a fallback
      }
    }

    return celebrity;
  }

  async findOne(id: string): Promise<Celebrity> {
    const celebrity = await this.celebrityModel.findById(id).exec();
    if (!celebrity) {
      throw new NotFoundException('Celebrity not found');
    }
    return celebrity;
  }

  async update(id: string, updateDto: Partial<CreateCelebrityDto>): Promise<Celebrity> {
    if (updateDto.name && !updateDto.slug) {
        updateDto.slug = this.generateSlug(updateDto.name);
    }

    // If birth details are updated, clear the cached kundliData
    const birthFields = ['birthDate', 'birthTime', 'latitude', 'longitude', 'timezone'];
    const isBirthInfoUpdated = birthFields.some(field => field in updateDto);

    const updateData: any = { ...updateDto };
    if (isBirthInfoUpdated) {
      this.logger.log(`⚠️ Birth details updated for ID ${id}. Clearing cached kundliData.`);
      updateData.kundliData = null; // Forces recalculation on next access
    }

    const updated = await this.celebrityModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
      
    if (!updated) {
      throw new NotFoundException('Celebrity not found');
    }
    return updated;
  }

  async remove(id: string): Promise<any> {
    return this.celebrityModel.findByIdAndDelete(id).exec();
  }
}
