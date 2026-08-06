import { IsString, IsEmail, IsNumber, IsOptional, IsNotEmpty, Min } from 'class-validator';

export class CreateReportBookingDto {
  @IsString()
  @IsNotEmpty()
  reportName: string;

  @IsString()
  @IsNotEmpty()
  reportSlug: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  dob: string;

  @IsString()
  @IsNotEmpty()
  tob: string;

  @IsString()
  @IsNotEmpty()
  pob: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
