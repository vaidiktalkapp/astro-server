import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateAstrologyDto {
  @ApiProperty({ example: 'Vishal' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1995-05-15', description: 'YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '14:30', description: 'HH:mm' })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiProperty({ example: '28.6139' })
  @IsString()
  @IsNotEmpty()
  lat: string;

  @ApiProperty({ example: '77.2090' })
  @IsString()
  @IsNotEmpty()
  lon: string;

  @ApiProperty({ example: 5.5, default: 5.5 })
  @IsNumber()
  @IsOptional()
  tzone?: number = 5.5;

  @ApiProperty({ example: 'New Delhi, India' })
  @IsString()
  @IsOptional()
  place?: string;
}
