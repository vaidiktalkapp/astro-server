import { Controller, Post, Get, Body, Query, UseGuards, Request, Headers } from '@nestjs/common';
import { ReportBookingsService } from './report-bookings.service';
import { CreateReportBookingDto } from './dto/create-report-booking.dto';
import { VerifyReportPaymentDto } from './dto/verify-report-payment.dto';
import * as jwt from 'jsonwebtoken';

@Controller('report-bookings')
export class ReportBookingsController {
  constructor(private readonly reportBookingsService: ReportBookingsService) {}

  @Post('create-order')
  async createOrder(@Body() createDto: CreateReportBookingDto, @Headers('authorization') authHeader: string) {
    let userId: string | undefined = undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || '144ec66a61d35593eb26f29548ddd9ba');
        userId = decoded.id || decoded._id || undefined;
      } catch (err: any) {
        console.error('Invalid token in report booking:', err.message);
      }
    }
    return this.reportBookingsService.createBooking(createDto, userId);
  }

  @Post('verify-payment')
  async verifyPayment(@Body() verifyDto: VerifyReportPaymentDto) {
    return this.reportBookingsService.verifyPayment(verifyDto);
  }

  @Post(':bookingId/generate-pdf')
  async generatePdf(@Request() req: any) {
    const bookingId = req.params.bookingId;
    return this.reportBookingsService.generatePdf(bookingId);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.reportBookingsService.findAll(query);
  }
}
