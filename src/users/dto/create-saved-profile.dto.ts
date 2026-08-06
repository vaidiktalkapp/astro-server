import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateSavedProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  gender?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  timeOfBirth: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  placeOfBirth: string;

  @IsString()
  @IsOptional()
  lat?: string;

  @IsString()
  @IsOptional()
  lon?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  maritalStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  occupation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  relation?: string;
}
