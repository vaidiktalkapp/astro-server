// src/astrologers/dto/update-astrologer-profile.dto.ts

import { IsString, IsOptional, IsArray, IsNumber, Min, Max, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAstrologerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000, { message: 'Bio cannot exceed 3000 characters' })
  bio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  experienceYears?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  profilePicture?: string;

  @IsOptional()
  @IsBoolean()
  isChatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isCallEnabled?: boolean;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];
}
