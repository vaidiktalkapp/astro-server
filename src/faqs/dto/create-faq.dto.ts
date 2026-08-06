import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}
