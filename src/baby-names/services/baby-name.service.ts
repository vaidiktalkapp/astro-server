import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BabyName, BabyNameDocument } from '../schemas/baby-name.schema';
import { CreateBabyNameDto, UpdateBabyNameDto } from '../dto/baby-name.dto';

@Injectable()
export class BabyNameService {
  private readonly logger = new Logger(BabyNameService.name);

  constructor(
    @InjectModel(BabyName.name) private babyNameModel: Model<BabyNameDocument>,
  ) {}

  // -------------------------------------------------------------------------
  // PUBLIC ENDPOINTS
  // -------------------------------------------------------------------------

  async getByAlphabet(letter: string, gender?: string, page = 1, limit = 50) {
    const filter: any = { 
      startingLetter: letter.toUpperCase(), 
      isActive: true,
      discoveryTypes: 'alphabet' 
    };
    if (gender && gender !== 'all') filter.gender = gender;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.babyNameModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      this.babyNameModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getByZodiac(sign: string, gender?: string, page = 1, limit = 50) {
    const filter: any = { 
      zodiacSign: { $regex: new RegExp(`^${sign}$`, 'i') }, 
      isActive: true,
      discoveryTypes: 'zodiac'
    };
    if (gender && gender !== 'all') filter.gender = gender;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.babyNameModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      this.babyNameModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getByNakshatra(nakshatra: string, gender?: string, page = 1, limit = 50) {
    const filter: any = { 
      nakshatra: { $regex: new RegExp(`^${nakshatra}$`, 'i') }, 
      isActive: true,
      discoveryTypes: 'nakshatra'
    };
    if (gender && gender !== 'all') filter.gender = gender;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.babyNameModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      this.babyNameModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async search(query: string, gender?: string, page = 1, limit = 50) {
    const filter: any = {
      isActive: true,
      name: { $regex: `^${query}`, $options: 'i' },
    };
    // No strict discoveryTypes filter for general search unless specified
    if (gender && gender !== 'all') filter.gender = gender;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.babyNameModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      this.babyNameModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const [totalBoy, totalGirl, totalUnisex, totalNakshatra, totalZodiac, totalAll] = await Promise.all([
      this.babyNameModel.countDocuments({ gender: 'Boy', isActive: true }),
      this.babyNameModel.countDocuments({ gender: 'Girl', isActive: true }),
      this.babyNameModel.countDocuments({ gender: 'Unisex', isActive: true }),
      this.babyNameModel.countDocuments({ discoveryTypes: 'nakshatra', isActive: true }),
      this.babyNameModel.countDocuments({ discoveryTypes: 'zodiac', isActive: true }),
      this.babyNameModel.countDocuments({}),
    ]);
    
    return { 
      totalBoy, 
      totalGirl, 
      totalUnisex, 
      totalAll,
      totalNakshatra,
      totalZodiac,
      total: totalBoy + totalGirl + totalUnisex 
    };
  }

  // -------------------------------------------------------------------------
  // ADMIN CRUD
  // -------------------------------------------------------------------------

  async getAll(page = 1, limit = 50, gender?: string, search?: string, alphabet?: string, nakshatra?: string, zodiacSign?: string) {
    const filter: any = {};
    if (gender && gender !== 'all') filter.gender = gender;
    
    // In Admin, filtering by "By Alphabet" tab should only show names tagged for 'alphabet' discovery
    if (alphabet) {
      filter.startingLetter = { $regex: new RegExp(`^${alphabet}$`, 'i') };
      filter.discoveryTypes = 'alphabet';
    }
    
    if (nakshatra) {
      filter.discoveryTypes = 'nakshatra';
      if (nakshatra !== '__EXISTS__') {
        filter.nakshatra = { $regex: new RegExp(`^${nakshatra}$`, 'i') };
      }
    }
    
    if (zodiacSign) {
      filter.discoveryTypes = 'zodiac';
      if (zodiacSign !== '__EXISTS__') {
        filter.zodiacSign = { $regex: new RegExp(`^${zodiacSign}$`, 'i') };
      }
    }
    
    if (search) {
      filter.name = { $regex: `^${search}`, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.babyNameModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.babyNameModel.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private calculateChaldeanDestinyNumber(name: string): number {
    const table: { [key: string]: number } = {
      A: 1, I: 1, J: 1, Q: 1, Y: 1,
      B: 2, K: 2, R: 2,
      C: 3, G: 3, L: 3, S: 3,
      D: 4, M: 4, T: 4,
      E: 5, H: 5, N: 5, X: 5,
      U: 6, V: 6, W: 6,
      O: 7, Z: 7,
      F: 8, P: 8,
    };

    let sum = 0;
    const cleanName = name.toUpperCase().replace(/[^A-Z]/g, '');
    for (let i = 0; i < cleanName.length; i++) {
      sum += table[cleanName[i]] || 0;
    }

    // Reduce to single digit
    while (sum > 9) {
      sum = sum.toString().split('').reduce((acc, curr) => acc + parseInt(curr), 0);
    }

    return sum;
  }

  async create(dto: CreateBabyNameDto) {
    const trimmedName = dto.name.trim();
    const startingLetter = trimmedName.charAt(0).toUpperCase();
    const nameLength = trimmedName.length;
    const numerologyNumber = dto.numerologyNumber || this.calculateChaldeanDestinyNumber(trimmedName);
    
    // Build update payload carefully to avoid overwriting existing data with empty strings
    const updatePayload: any = { 
      name: trimmedName,
      startingLetter,
      nameLength,
      numerologyNumber,
      meaning: dto.meaning,
      gender: dto.gender,
    };

    if (dto.zodiacSign?.trim()) updatePayload.zodiacSign = dto.zodiacSign.trim();
    if (dto.nakshatra?.trim()) updatePayload.nakshatra = dto.nakshatra.trim();
    if (dto.origin?.trim()) updatePayload.origin = dto.origin.trim();
    if (dto.isActive !== undefined) updatePayload.isActive = dto.isActive;

    const types = dto.discoveryTypes || ['alphabet'];

    return this.babyNameModel.findOneAndUpdate(
      { name: trimmedName, gender: dto.gender },
      { 
        $set: updatePayload,
        $addToSet: { discoveryTypes: { $each: types } }
      },
      { upsert: true, new: true }
    );
  }

  async update(id: string, dto: any) {
    const updateData: any = { ...dto };
    if (dto.name) {
      const trimmedName = dto.name.trim();
      updateData.name = trimmedName;
      updateData.startingLetter = trimmedName.charAt(0).toUpperCase();
      updateData.nameLength = trimmedName.length;
      if (!dto.numerologyNumber) {
        updateData.numerologyNumber = this.calculateChaldeanDestinyNumber(trimmedName);
      }
    }

    // Handle discoveryTypes merging if provided as an array
    if (dto.discoveryTypes) {
      const types = dto.discoveryTypes;
      delete updateData.discoveryTypes;
      return this.babyNameModel.findByIdAndUpdate(
        id, 
        { 
          $set: updateData,
          $addToSet: { discoveryTypes: { $each: types } }
        }, 
        { new: true }
      );
    }

    const updated = await this.babyNameModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!updated) throw new Error('Baby name not found');
    return updated;
  }

  async delete(id: string) {
    const result = await this.babyNameModel.findByIdAndDelete(id);
    if (!result) throw new Error('Baby name not found');
    return { message: 'Deleted successfully' };
  }

  async bulkCreate(names: any[]) {
    const ops = names.map(dto => {
      const trimmedName = dto.name.trim();
      const numerologyNumber = dto.numerologyNumber || this.calculateChaldeanDestinyNumber(trimmedName);
      const startingLetter = trimmedName.charAt(0).toUpperCase();
      const nameLength = trimmedName.length;
      
      const types = dto.discoveryTypes || ['alphabet'];
      
      const updatePayload: any = {
        name: trimmedName,
        startingLetter,
        nameLength,
        numerologyNumber,
        meaning: dto.meaning,
        gender: dto.gender,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      };

      if (dto.zodiacSign?.trim()) updatePayload.zodiacSign = dto.zodiacSign.trim();
      if (dto.nakshatra?.trim()) updatePayload.nakshatra = dto.nakshatra.trim();
      if (dto.origin?.trim()) updatePayload.origin = dto.origin.trim();

      return {
        updateOne: {
          filter: { name: trimmedName, gender: dto.gender },
          update: {
            $set: updatePayload,
            $addToSet: { discoveryTypes: { $each: types } }
          },
          upsert: true
        }
      };
    });

    const result = await this.babyNameModel.bulkWrite(ops);
    return { 
      inserted: result.upsertedCount, 
      updated: result.modifiedCount 
    };
  }

  // Temporary method to backfill missing destiny numbers and discovery types
  // Method to backfill missing destiny numbers and discovery types
  async backfillDestinyNumbers() {
    const all = await this.babyNameModel.find({});
    
    let count = 0;
    for (const entry of all) {
      const updatePayload: any = {};
      let needsUpdate = false;

      if (!entry.numerologyNumber) {
        updatePayload.numerologyNumber = this.calculateChaldeanDestinyNumber(entry.name);
        needsUpdate = true;
      }
      
      let types = entry.discoveryTypes ? [...entry.discoveryTypes] : ['alphabet'];
      let originalLength = types.length;

      if (!types.includes('alphabet')) types.push('alphabet');
      if (entry.nakshatra && entry.nakshatra.trim() !== '' && !types.includes('nakshatra')) types.push('nakshatra');
      if (entry.zodiacSign && entry.zodiacSign.trim() !== '' && !types.includes('zodiac')) types.push('zodiac');

      if (types.length !== originalLength || !entry.discoveryTypes) {
        updatePayload.discoveryTypes = types;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.babyNameModel.updateOne({ _id: entry._id }, { $set: updatePayload });
        count++;
      }
    }
    return { backfilled: count };
  }
}
