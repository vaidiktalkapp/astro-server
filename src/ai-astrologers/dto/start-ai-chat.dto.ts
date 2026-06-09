import { IsNotEmpty, IsString, IsMongoId, IsOptional } from 'class-validator';

export class StartAiChatDto {
    @IsNotEmpty()
    @IsMongoId()
    astrologerId: string;

    @IsOptional()
    @IsString()
    message: string;

    @IsNotEmpty()
    @IsString()
    userName: string;

    @IsNotEmpty()
    @IsString()
    dateOfBirth: string; // DD-MM-YYYY

    @IsNotEmpty()
    @IsString()
    timeOfBirth: string; // HH:MM

    @IsNotEmpty()
    @IsString()
    placeOfBirth: string;

    @IsOptional()
    @IsString()
    lat?: string;

    @IsOptional()
    @IsString()
    lon?: string;

    @IsOptional()
    @IsString()
    language?: string;
}
