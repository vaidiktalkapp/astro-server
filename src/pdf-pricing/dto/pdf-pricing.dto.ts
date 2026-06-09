import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePdfPricingDto {
  @IsOptional()
  @IsString()
  toolName?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePdfPricingDto {
  @IsString()
  toolKey: string;

  @IsString()
  toolName: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
