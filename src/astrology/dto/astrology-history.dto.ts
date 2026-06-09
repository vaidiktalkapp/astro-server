import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class SaveAstrologyHistoryDto {
  @IsString()
  @IsNotEmpty()
  featureType: string;

  @IsObject()
  @IsNotEmpty()
  data: any;
}
