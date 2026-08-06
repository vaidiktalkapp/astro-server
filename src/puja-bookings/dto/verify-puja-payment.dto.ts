import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPujaPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;
}
