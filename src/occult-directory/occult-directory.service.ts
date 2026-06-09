import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DirectorySettings } from './schemas/directory-settings.schema';
import { CreateDirectorySettingsDto } from './dto/create-directory-settings.dto';
import { UpdateDirectorySettingsDto } from './dto/update-directory-settings.dto';

import { Astrologer, AstrologerDocument } from '../astrologers/schemas/astrologer.schema';

@Injectable()
export class OccultDirectoryService {
  constructor(
    @InjectModel(DirectorySettings.name)
    private settingsModel: Model<DirectorySettings>,
    @InjectModel(Astrologer.name)
    private astrologerModel: Model<AstrologerDocument>,
  ) {}

  async getExpertiseByCity(city: string): Promise<string[]> {
    const settings = await this.getSettings();
    const mapping = settings.cityExpertiseMap.find(
      m => m.city.toLowerCase() === city.toLowerCase()
    );

    // If admin has defined a specific mapping for this city, use it
    if (mapping) {
      return mapping.expertise;
    }

    // Fallback: Continue to show what's currently available based on active astrologers
    const pipe = [
      { $match: { city: { $regex: new RegExp(`^${city}$`, 'i') }, accountStatus: 'active' } },
      { $unwind: '$specializations' },
      { $group: { _id: '$specializations' } },
      { $sort: { _id: 1 } }
    ];
    const results = await this.astrologerModel.aggregate(pipe as any);
    return results.map(r => r._id);
  }

  async getSettings(): Promise<DirectorySettings> {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create({
        cities: [],
        popularCities: [],
        expertise: [],
        languages: [],
      });
    }
    return settings;
  }

  async updateSettings(
    updateDto: UpdateDirectorySettingsDto,
  ): Promise<DirectorySettings> {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create(updateDto);
    } else {
      const updatedSettings = await this.settingsModel.findByIdAndUpdate(
        settings._id,
        updateDto,
        { new: true },
      );
      return updatedSettings!;
    }
    return settings;
  }

  async addCity(city: string): Promise<DirectorySettings> {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create({ cities: [city] });
    } else if (!settings.cities.includes(city)) {
      settings.cities.push(city);
      await settings.save();
    }
    return settings;
  }

  async removeCity(city: string): Promise<DirectorySettings> {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { 
        $pull: { 
          cities: city, 
          popularCities: city,
          cityExpertiseMap: { city: city }
        } 
      },
      { new: true },
    );
    if (!settings) {
      return this.getSettings();
    }
    return settings;
  }

  async updateCityExpertise(city: string, expertises: string[]): Promise<DirectorySettings> {
    const settings = await this.getSettings();
    
    const index = settings.cityExpertiseMap.findIndex(m => m.city === city);
    if (index > -1) {
      settings.cityExpertiseMap[index].expertise = expertises;
    } else {
      settings.cityExpertiseMap.push({ city, expertise: expertises });
    }

    // Force Mongoose to recognize the change in the subdocument array
    settings.markModified('cityExpertiseMap');
    await settings.save();
    return settings;
  }

  async addPopularCity(city: string): Promise<DirectorySettings> {
    const settings = await this.getSettings();
    const cityExists = settings.cities.some(c => c.toLowerCase() === city.toLowerCase());
    if (!cityExists) {
        throw new Error(`City "${city}" must be added to "All Cities" before marking as popular.`);
    }
    
    if (!settings.popularCities.includes(city)) {
      settings.popularCities.push(city);
      await settings.save();
    }
    return settings;
  }

  async togglePopularCity(city: string): Promise<DirectorySettings> {
    const settings = await this.getSettings();
    const isPopular = settings.popularCities.includes(city);
    
    if (isPopular) {
      settings.popularCities = settings.popularCities.filter(c => c !== city);
    } else {
      const cityExists = settings.cities.includes(city);
      if (!cityExists) {
        throw new Error('City must exist in All Cities first');
      }
      settings.popularCities.push(city);
    }
    
    await settings.save();
    return settings;
  }

  async removePopularCity(city: string): Promise<DirectorySettings> {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { $pull: { popularCities: city } },
      { new: true },
    );
    if (!settings) {
      return this.getSettings();
    }
    return settings;
  }

  async addExpertise(skill: string): Promise<DirectorySettings> {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create({ expertise: [skill] });
    } else if (!settings.expertise.includes(skill)) {
      settings.expertise.push(skill);
      await settings.save();
    }
    return settings;
  }

  async removeExpertise(skill: string): Promise<DirectorySettings> {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { $pull: { expertise: skill } },
      { new: true },
    );
    if (!settings) {
      return this.getSettings();
    }
    return settings;
  }

  async addLanguage(language: string): Promise<DirectorySettings> {
    let settings = await this.settingsModel.findOne();
    if (!settings) {
      settings = await this.settingsModel.create({ languages: [language] });
    } else if (!settings.languages.includes(language)) {
      settings.languages.push(language);
      await settings.save();
    }
    return settings;
  }

  async removeLanguage(language: string): Promise<DirectorySettings> {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { $pull: { languages: language } },
      { new: true },
    );
    if (!settings) {
      return this.getSettings();
    }
    return settings;
  }
}
