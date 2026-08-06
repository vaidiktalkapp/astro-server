import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsEmail } from 'class-validator';

export class CreatePujaBookingDto {
  @IsString()
  @IsNotEmpty()
  pujaName: string;

  @IsString()
  @IsNotEmpty()
  pujaSlug: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsOptional()
  gotra?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsDateString()
  @IsNotEmpty()
  preferredDate: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
