import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateBabyNameDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  meaning: string;

  @IsEnum(['Boy', 'Girl', 'Unisex'])
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsOptional()
  zodiacSign?: string;

  @IsString()
  @IsOptional()
  nakshatra?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsOptional()
  numerologyNumber?: number;

  @IsOptional()
  nameLength?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  discoveryTypes?: string[];
}

export class UpdateBabyNameDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  meaning?: string;

  @IsEnum(['Boy', 'Girl', 'Unisex'])
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  zodiacSign?: string;

  @IsString()
  @IsOptional()
  nakshatra?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsOptional()
  numerologyNumber?: number;

  @IsOptional()
  nameLength?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  discoveryTypes?: string[];
}
