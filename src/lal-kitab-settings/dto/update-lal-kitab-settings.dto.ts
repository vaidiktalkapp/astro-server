import { IsOptional, IsObject, IsArray, IsString } from 'class-validator';

export class UpdateLalKitabSettingsDto {
  @IsOptional()
  @IsObject()
  planetOverrides?: Record<string, any>;

  @IsOptional()
  @IsArray()
  lifeAreaRemedies?: any[];

  @IsOptional()
  @IsArray()
  generalRules?: string[];

  @IsOptional()
  @IsObject()
  systemPrompts?: {
    general?: string;
    specific?: string;
  };
}
