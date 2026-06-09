import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './controllers/reports.controller';
import { FreeReportsController } from './controllers/free-reports.controller';
import { AstrologerReportsController } from './controllers/astrologer-reports.controller';
import { ReportsService } from './services/reports.service';
import { Report, ReportSchema } from './schemas/reports.schema';

import { AiAstrologersModule } from '../ai-astrologers/ai-astrologers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
    ]),
    forwardRef(() => AiAstrologersModule),
  ],
  controllers: [ReportsController, FreeReportsController, AstrologerReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
