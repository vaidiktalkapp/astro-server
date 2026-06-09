import { IsNotEmpty, IsString, IsMongoId } from 'class-validator';

export class SendAiMessageDto {
    @IsNotEmpty()
    @IsString()
    sessionId: string;

    @IsNotEmpty()
    @IsString()
    message: string;

    @IsNotEmpty()
    @IsString()
    @IsMongoId()
    userId: string;
}
