import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PdfPricing } from '../schemas/pdf-pricing.schema';
import { WalletService } from '../../payments/services/wallet.service';
import { CreatePdfPricingDto, UpdatePdfPricingDto } from '../dto/pdf-pricing.dto';

@Injectable()
export class PdfPricingService {
  constructor(
    @InjectModel(PdfPricing.name)
    private pdfPricingModel: Model<PdfPricing>,
    private walletService: WalletService,
  ) {}

  /**
   * Get all PDF prices
   */
  async getAllPrices() {
    return this.pdfPricingModel.find().lean();
  }

  /**
   * Get price for a specific tool
   */
  async getPrice(toolKey: string) {
    const pricing = await this.pdfPricingModel.findOne({ toolKey }).lean();
    if (!pricing) return { price: 0, isActive: false };
    return pricing;
  }

  /**
   * Update or Create a price (Admin)
   */
  async updatePrice(toolKey: string, dto: UpdatePdfPricingDto) {
    return this.pdfPricingModel.findOneAndUpdate(
      { toolKey },
      { ...dto, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  /**
   * Initialize default prices if they don't exist
   */
  async seedPrices() {
    const defaultTools = [
      { key: 'compatibility', name: 'Love & Name Compatibility' },
      { key: 'kundli', name: 'Kundli / Horoscope' },
      { key: 'matching', name: 'Horoscope Matching' },
      { key: 'numerology', name: 'Numerology Report' },
      { key: 'kaal-sarp', name: 'Kaal Sarp Dosha' },
      { key: 'sade-sati', name: 'Sade Sati Report' },
      { key: 'gemstone', name: 'Gemstone Recommendation' },
      { key: 'lalkitab', name: 'Lal Kitab' },
      { key: 'moonsign', name: 'Moon Sign Report' },
      { key: 'rashi', name: 'Rashi Report' },
      { key: 'chinese-zodiac', name: 'Chinese Zodiac' },
      { key: 'rahu-kaal', name: 'Rahu Kaal Report' },
      { key: 'celebrity-horoscope', name: 'Celebrity Horoscope Report' },
      { key: 'manglik-dosha', name: 'Manglik Dosha Report' },
      { key: 'planets', name: 'Planetary Transit Report' },
      { key: 'panchang', name: 'Daily Panchang Report' },
    ];

    for (const tool of defaultTools) {
      const exists = await this.pdfPricingModel.findOne({ toolKey: tool.key });
      if (!exists) {
        await this.pdfPricingModel.create({
          toolKey: tool.key,
          toolName: tool.name,
          price: 0, // Default to free initially
          isActive: true
        });
      }
    }
  }

  /**
   * Purchase a PDF report
   */
  async purchasePdf(userId: string, toolKey: string, reportName?: string) {
    const pricing = await this.pdfPricingModel.findOne({ toolKey });
    
    if (!pricing || !pricing.isActive || pricing.price <= 0) {
      return { success: true, message: 'Tool is free or not set' };
    }

    const description = `PDF Download - ${pricing.toolName}${reportName ? ` (${reportName})` : ''}`;
    
    const result = await this.walletService.deductFromUser(
      userId,
      pricing.price,
      'pdf_purchase',
      description,
      { toolKey, reportName }
    );

    if (!result.success) {
      throw new BadRequestException(result.message || 'Payment failed');
    }

    return result;
  }
}
