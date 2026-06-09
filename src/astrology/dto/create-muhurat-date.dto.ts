import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, IsMongoId } from 'class-validator';

export class CreateMuhuratDateDto {
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  nakshatra: string;

  @IsString()
  @IsNotEmpty()
  tithi: string;

  @IsString()
  @IsNotEmpty()
  muhurat_start: string;

  @IsString()
  @IsNotEmpty()
  muhurat_end: string;

  @IsString()
  @IsOptional()
  sun_rise?: string;

  @IsString()
  @IsOptional()
  sun_set?: string;

  @IsNumber()
  @IsOptional()
  quality_score?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reasons_good?: string[];

  @IsString()
  @IsOptional()
  aiVerdict?: string;

  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;
}
