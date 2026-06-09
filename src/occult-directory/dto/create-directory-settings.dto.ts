import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateDirectorySettingsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  popularCities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];
}
