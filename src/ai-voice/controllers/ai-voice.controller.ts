import { Controller, Post, Body, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { AiVoiceService } from '../services/ai-voice.service';

@Controller('ai-voice')
export class AiVoiceController {
  private readonly logger = new Logger(AiVoiceController.name);

  constructor(private readonly aiVoiceService: AiVoiceService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  async initiateCall(
    @Body() data: { userId: string; aiId: string; language?: string; intakeData?: any }
  ) {
    if (!data.userId || !data.aiId) {
      throw new BadRequestException('Both userId and aiId are required');
    }
    
    this.logger.log(`📥 Initiating AI Voice Call: User=${data.userId}, AI=${data.aiId}`);
    try {
      return await this.aiVoiceService.initiateAiVoiceCall(data.userId, data.aiId, data.language, data.intakeData);
    } catch (error) {
      this.logger.error(`❌ Failed to initiate AI Voice Call: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('webhook/vapi')
  @HttpCode(HttpStatus.OK)
  async handleVapiWebhook(@Body() payload: any) {
    const type = payload?.type || payload?.message?.type;
    this.logger.log(`📥 Received Vapi.ai Webhook: Type=${type}`);
    return this.aiVoiceService.handleVapiWebhook(payload);
  }
}
