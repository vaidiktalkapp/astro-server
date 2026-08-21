import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PujaBooking, PujaBookingDocument } from './schemas/puja-booking.schema';
import { CreatePujaBookingDto } from './dto/create-puja-booking.dto';
import { RazorpayService } from '../payments/services/razorpay.service';
import { VerifyPujaPaymentDto } from './dto/verify-puja-payment.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PujaBookingsService {
  constructor(
    @InjectModel(PujaBooking.name) private pujaBookingModel: Model<PujaBookingDocument>,
    private razorpayService: RazorpayService,
  ) {}

  async createBooking(createDto: CreatePujaBookingDto, userId?: string) {
    // 1. Generate unique booking ID
    const bookingId = `PUJA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 2. Create Razorpay order
    // Ensure amount is at least 1 INR
    if (createDto.amount < 1) {
      throw new BadRequestException('Amount must be at least ₹1');
    }

    const orderResponse = await this.razorpayService.createOrder(
      createDto.amount,
      'INR',
      userId || 'GUEST',
      bookingId,
    );

    if (!orderResponse.success || !orderResponse.gatewayOrderId) {
      throw new BadRequestException('Failed to generate payment order');
    }

    // 3. Save booking to DB with pending status
    const booking = new this.pujaBookingModel({
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

  async verifyPayment(verifyDto: VerifyPujaPaymentDto) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyDto;

    // 1. Find booking
    const booking = await this.pujaBookingModel.findOne({ razorpayOrderId: razorpay_order_id });
    if (!booking) {
      throw new NotFoundException('Booking not found for this order ID');
    }

    if (booking.status === 'paid') {
      return { success: true, message: 'Payment already verified', booking };
    }

    // 2. Verify signature using Razorpay service
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

    // 3. Update booking status to paid
    booking.status = 'paid';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    booking.paidAt = new Date();
    
    await booking.save();

    return {
      success: true,
      message: 'Payment verified and booking confirmed successfully',
      bookingId: booking.bookingId,
    };
  }

  async findAll(query: any) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.userId) {
      const { Types } = require('mongoose');
      try {
        filter.userId = new Types.ObjectId(query.userId);
      } catch (e) {
        filter.userId = query.userId;
      }
    }

    return this.pujaBookingModel.find(filter).sort({ createdAt: -1 }).exec();
  }
}
