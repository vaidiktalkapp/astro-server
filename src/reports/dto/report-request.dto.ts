import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class ReportRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    date: string;

    @IsString()
    @IsNotEmpty()
    time: string;

    @IsString()
    @IsNotEmpty()
    place: string;

    @IsNumber()
    lat: number;

    @IsNumber()
    lon: number;

    @IsNumber()
    @IsOptional()
    tzone?: number = 5.5;
}
