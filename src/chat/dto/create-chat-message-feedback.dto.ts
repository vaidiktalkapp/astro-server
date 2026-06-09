import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateChatMessageFeedbackDto {
  @IsEnum(['thumbs_up', 'thumbs_down'])
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsOptional()
  astrologerId?: string;

  @IsEnum(['Astrologer', 'AiAstrologerProfile'])
  @IsOptional()
  astrologerModel?: string;
}
