import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PujaBookingsController } from './puja-bookings.controller';
import { PujaBookingsService } from './puja-bookings.service';
import { PujaBooking, PujaBookingSchema } from './schemas/puja-booking.schema';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PujaBooking.name, schema: PujaBookingSchema },
    ]),
    PaymentsModule, // To access RazorpayService
  ],
  controllers: [PujaBookingsController],
  providers: [PujaBookingsService],
  exports: [PujaBookingsService],
})
export class PujaBookingsModule {}
