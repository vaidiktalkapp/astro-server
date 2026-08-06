import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SmartKundaliSetting, SmartKundaliSettingDocument } from './schemas/smart-kundali-setting.schema';

@Injectable()
export class SmartKundaliSettingsService {
  constructor(
    @InjectModel(SmartKundaliSetting.name) private settingModel: Model<SmartKundaliSettingDocument>
  ) { }

  async getSettings(reportSlug: string) {
    let settings = await this.settingModel.findOne({ reportSlug });
    if (!settings) {
      // Create default if not found
      settings = await this.settingModel.create({
        reportSlug,
        video: { url: '', thumbnail: '/images/kundali-video-thumb.jpg' },
        screenshots: [
          { url: '/images/kundali-page-1.jpg' },
          { url: '/images/kundali-page-2.jpg' },
          { url: '/images/kundali-page-3.jpg' },
          { url: '/images/kundali-page-4.jpg' },
          { url: '/images/kundali-page-5.jpg' }
        ],
        faqs: [],
        testimonials: [
          { name: "Rahul Verma", city: "Delhi", date: "October 2025", review: "The 10-year Kundali gave me exactly what I needed—clarity.", initial: "R", color: "#5c1a1f" },
          { name: "Sneha Patel", city: "Ahmedabad", date: "September 2025", review: "I was looking for something more than just basic astrology.", initial: "S", color: "#d97706" },
          { name: "Ankit Sharma", city: "Pune", date: "August 2025", review: "The dosha analysis and personalized remedies were an eye-opener.", initial: "A", color: "#1a0a0b" }
        ]
      });
    }
    return settings;
  }

  async updateSettings(reportSlug: string, updateData: any) {
    return this.settingModel.findOneAndUpdate(
      { reportSlug },
      { $set: updateData },
      { new: true, upsert: true }
    );
  }
}
