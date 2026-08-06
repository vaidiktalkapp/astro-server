import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ReportBookingsService } from './report-bookings.service';
import { CreateReportBookingDto } from './dto/create-report-booking.dto';
import { VerifyReportPaymentDto } from './dto/verify-report-payment.dto';

@Controller('report-bookings')
export class ReportBookingsController {
  constructor(private readonly reportBookingsService: ReportBookingsService) {}

  @Post('create-order')
  async createOrder(@Body() createDto: CreateReportBookingDto, @Request() req: any) {
    const userId = req.user?.id || req.user?._id || null;
    return this.reportBookingsService.createBooking(createDto, userId);
  }

  @Post('verify-payment')
  async verifyPayment(@Body() verifyDto: VerifyReportPaymentDto) {
    return this.reportBookingsService.verifyPayment(verifyDto);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.reportBookingsService.findAll(query);
  }
}
