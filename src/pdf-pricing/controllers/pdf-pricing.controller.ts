import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PdfPricingService } from '../services/pdf-pricing.service';
import { UpdatePdfPricingDto } from '../dto/pdf-pricing.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('pdf-pricing')
export class PdfPricingController {
  constructor(private readonly pdfPricingService: PdfPricingService) {}

  /**
   * Get all prices (For Admin and App)
   */
  @Get()
  async getAllPrices() {
    return {
      success: true,
      data: await this.pdfPricingService.getAllPrices(),
    };
  }

  /**
   * Get price for a specific tool
   */
  @Get(':toolKey')
  async getPrice(@Param('toolKey') toolKey: string) {
    return {
      success: true,
      data: await this.pdfPricingService.getPrice(toolKey),
    };
  }

  /**
   * Update price (Admin Only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':toolKey')
  async updatePrice(
    @Param('toolKey') toolKey: string,
    @Body() dto: UpdatePdfPricingDto,
  ) {
    return {
      success: true,
      data: await this.pdfPricingService.updatePrice(toolKey, dto),
    };
  }

  /**
   * Purchase PDF (User)
   */
  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  async purchasePdf(
    @Req() req: any,
    @Body() body: { toolKey: string; reportName?: string },
  ) {
    const result = await this.pdfPricingService.purchasePdf(
      req.user.userId,
      body.toolKey,
      body.reportName
    );

    return result;
  }

  /**
   * Seed defaults (Admin Only - One time use)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('seed')
  async seedPrices() {
    await this.pdfPricingService.seedPrices();
    return { success: true, message: 'Prices seeded' };
  }
}
