import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportBookingsController } from './report-bookings.controller';
import { ReportBookingsService } from './report-bookings.service';
import { ReportBooking, ReportBookingSchema } from './schemas/report-booking.schema';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportBooking.name, schema: ReportBookingSchema },
    ]),
    PaymentsModule,
  ],
  controllers: [ReportBookingsController],
  providers: [ReportBookingsService],
  exports: [ReportBookingsService],
})
export class ReportBookingsModule {}
