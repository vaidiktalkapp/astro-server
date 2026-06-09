import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PdfPricingController } from './controllers/pdf-pricing.controller';
import { PdfPricingService } from './services/pdf-pricing.service';
import { PdfPricing, PdfPricingSchema } from './schemas/pdf-pricing.schema';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PdfPricing.name, schema: PdfPricingSchema }]),
    PaymentsModule, // Required for wallet operations
  ],
  controllers: [PdfPricingController],
  providers: [PdfPricingService],
  exports: [PdfPricingService],
})
export class PdfPricingModule {}
