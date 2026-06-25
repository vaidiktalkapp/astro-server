import { IsString, IsOptional, IsNumber, IsArray, IsEnum, MaxLength, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAstrologerProfileDto {
  @ApiPropertyOptional({ description: 'Astrologer Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Date of Birth (ISO format)' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsEnum(['male', 'female', 'other'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Short bio' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Years of Experience' })
  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Languages known' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ description: 'Specializations' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsString({ each: true })
  specializations?: string[];
}
