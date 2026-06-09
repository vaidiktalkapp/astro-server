import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class VerifyApplePaymentDto {
    @IsString({ message: 'Receipt is required' })
    @IsNotEmpty()
    receipt: string;

    @IsString({ message: 'Apple Transaction ID is required' })
    @IsNotEmpty()
    transactionId: string;

    @IsString({ message: 'Product ID is required' })
    @IsNotEmpty()
    productId: string;

    @IsOptional()
    @IsNumber({}, { message: 'Base Amount is required for manual matching' })
    amount?: number;

    @IsOptional()
    @IsNumber({}, { message: 'Bonus percentage must be a number' })
    bonusPercentage?: number;
}
