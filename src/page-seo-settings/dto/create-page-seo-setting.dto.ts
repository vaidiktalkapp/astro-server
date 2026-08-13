import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FaqItem {
  @IsString()
  q: string;

  @IsString()
  a: string;
}

export class CreatePageSeoSettingDto {
  @IsString()
  pageSlug: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  seoKeywords?: string;

  @IsOptional()
  @IsString()
  schemaMarkup?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItem)
  faqs?: FaqItem[];
}
