import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportBooking, ReportBookingDocument } from './schemas/report-booking.schema';
import { CreateReportBookingDto } from './dto/create-report-booking.dto';
import { VerifyReportPaymentDto } from './dto/verify-report-payment.dto';
import { RazorpayService } from '../payments/services/razorpay.service';

@Injectable()
export class ReportBookingsService {
  constructor(
    @InjectModel(ReportBooking.name) private reportBookingModel: Model<ReportBookingDocument>,
    private razorpayService: RazorpayService,
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

  async findAll(query: any) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    if (query.reportSlug) filter.reportSlug = query.reportSlug;
    return this.reportBookingModel.find(filter).sort({ createdAt: -1 }).exec();
  }
}
