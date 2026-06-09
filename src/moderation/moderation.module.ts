import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModerationController } from './controllers/moderation.controller';
import { ModerationService } from './services/moderation.service';
import { AbuseReport, AbuseReportSchema } from './schemas/abuse-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AbuseReport.name, schema: AbuseReportSchema }]),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}