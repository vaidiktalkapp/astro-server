import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateSeoSettingsDto {
  @IsOptional()
  @IsString()
  robotsTxtContent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalSitemapUrls?: string[];
}
