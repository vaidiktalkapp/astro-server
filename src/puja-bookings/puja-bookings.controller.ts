import { Controller, Post, Body, Get, Query, UseGuards, Req } from '@nestjs/common';
import { PujaBookingsService } from './puja-bookings.service';
import { CreatePujaBookingDto } from './dto/create-puja-booking.dto';
import { VerifyPujaPaymentDto } from './dto/verify-puja-payment.dto';
// Optional: Use JwtAuthGuard if you want to identify logged in users
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('puja-bookings')
export class PujaBookingsController {
  constructor(private readonly pujaBookingsService: PujaBookingsService) {}

  @Post('create-order')
  createBooking(@Body() createDto: CreatePujaBookingDto, @Req() req: any) {
    // If you add JwtAuthGuard optionally, req.user will have the userId
    const userId = req.user?.id || null;
    return this.pujaBookingsService.createBooking(createDto, userId);
  }

  @Post('verify-payment')
  verifyPayment(@Body() verifyDto: VerifyPujaPaymentDto) {
    return this.pujaBookingsService.verifyPayment(verifyDto);
  }

  // Admin or user route to fetch bookings
  @Get()
  findAll(@Query() query: any) {
    return this.pujaBookingsService.findAll(query);
  }
}
