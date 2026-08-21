import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportBooking, ReportBookingDocument } from './schemas/report-booking.schema';
import { CreateReportBookingDto } from './dto/create-report-booking.dto';
import { VerifyReportPaymentDto } from './dto/verify-report-payment.dto';
import { RazorpayService } from '../payments/services/razorpay.service';
import { SmartKundliPdfService } from '../astrology/services/smart-kundli-pdf.service';

@Injectable()
export class ReportBookingsService {
  constructor(
    @InjectModel(ReportBooking.name) private reportBookingModel: Model<ReportBookingDocument>,
    private razorpayService: RazorpayService,
    private smartKundliPdfService: SmartKundliPdfService,
  ) {}

  async createBooking(createDto: CreateReportBookingDto, userId?: string) {
    if (createDto.amount < 1) {
      throw new BadRequestException('Amount must be at least ₹1');
    }

    const bookingId = `REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const orderResponse = await this.razorpayService.createOrder(
      createDto.amount,
      'INR',
      userId || 'GUEST',
      bookingId,
    );

    if (!orderResponse.success || !orderResponse.gatewayOrderId) {
      throw new BadRequestException('Failed to generate payment order');
    }

    const booking = new this.reportBookingModel({
      ...createDto,
      bookingId,
      userId: userId || null,
      currency: 'INR',
      status: 'pending',
      razorpayOrderId: orderResponse.gatewayOrderId,
    });

    await booking.save();

    return {
      success: true,
      bookingId: booking.bookingId,
      razorpayOrderId: orderResponse.gatewayOrderId,
      amount: createDto.amount,
      currency: 'INR',
      key: this.razorpayService.getKeyId(),
    };
  }

  async verifyPayment(verifyDto: VerifyReportPaymentDto) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyDto;

    const booking = await this.reportBookingModel.findOne({ razorpayOrderId: razorpay_order_id });
    if (!booking) {
      throw new NotFoundException('Booking not found for this order ID');
    }

    if (booking.status === 'paid') {
      return { success: true, message: 'Payment already verified', booking };
    }

    const isValid = this.razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      booking.status = 'failed';
      await booking.save();
      throw new BadRequestException('Invalid payment signature');
    }

    booking.status = 'paid';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    booking.paidAt = new Date();
    await booking.save();

    return {
      success: true,
      message: 'Payment verified and report booking confirmed',
      bookingId: booking.bookingId,
    };
  }

  async generatePdf(bookingId: string) {
    const booking = await this.reportBookingModel.findOne({ bookingId });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'paid') {
      throw new BadRequestException('Cannot generate PDF for unpaid booking');
    }

    if (booking.pdfStatus === 'generated' && booking.pdfUrl) {
      return { success: true, pdfUrl: booking.pdfUrl, status: 'already_generated' };
    }

    booking.pdfStatus = 'generating';
    await booking.save();

    try {
      const [year, month, day] = booking.dob.split('-').map(Number);
      const [hour, min] = booking.tob.split(':').map(Number);

      const pdfUrl = await this.smartKundliPdfService.generatePdf({
        name: booking.customerName,
        gender: booking.gender,
        day,
        month,
        year,
        hour,
        min,
        place: booking.pob,
        language: booking.language || 'en',
        chart_style: booking.chartStyle || 'NORTH_INDIAN',
      });

      booking.pdfUrl = pdfUrl;
      booking.pdfStatus = 'generated';
      await booking.save();

      return { success: true, pdfUrl, status: 'generated' };
    } catch (error: any) {
      booking.pdfStatus = 'failed';
      await booking.save();
      throw new BadRequestException(`Failed to generate PDF: ${error.message}`);
    }
  }

  async findAll(query: any) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.userId) {
      const Types = require('mongoose').Types;
      filter.userId = new Types.ObjectId(query.userId);
    }
    if (query.reportSlug) filter.reportSlug = query.reportSlug;
    return this.reportBookingModel.find(filter).sort({ createdAt: -1 }).exec();
  }
}
