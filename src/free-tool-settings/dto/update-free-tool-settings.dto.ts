import { IsOptional, IsObject } from 'class-validator';

export class UpdateFreeToolSettingsDto {
  @IsOptional()
  @IsObject()
  kaalSarp?: any;

  @IsOptional()
  @IsObject()
  sadeSati?: any;

  @IsOptional()
  @IsObject()
  gemstones?: any;

  @IsOptional()
  kaalSarpIntro?: string;

  @IsOptional()
  sadeSatiIntro?: string;

  @IsOptional()
  gemstonesIntro?: string;

  @IsOptional()
  kaalSarpResultMsg?: string;

  @IsOptional()
  kaalSarpNoDoshaMsg?: string;

  @IsOptional()
  sadeSatiResultMsg?: string;

  @IsOptional()
  gemstonesResultMsg?: string;

  @IsOptional()
  @IsObject()
  gemstoneRoleDescriptions?: any;
}
