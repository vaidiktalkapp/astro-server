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
    console.log('Headers:', req.headers);
    let userId: string | undefined = undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (decoded && decoded.userId) userId = decoded.userId;
      } catch (e) {
        console.error('Failed to decode token for puja booking', e);
      }
    }
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
