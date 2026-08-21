import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AstrologyController } from './controllers/astrology.controller';
import { MuhuratAdminController } from './controllers/muhurat-admin.controller';
import { MuhuratService } from './services/muhurat.service';
import { AiAstrologersModule } from '../ai-astrologers/ai-astrologers.module';
import { MuhuratCategory, MuhuratCategorySchema } from './schemas/muhurat-category.schema';
import { MuhuratManualDate, MuhuratManualDateSchema } from './schemas/muhurat-date.schema';
import { AstrologyHistory, AstrologyHistorySchema } from './schemas/astrology-history.schema';
import { AstrologyHistoryService } from './services/astrology-history.service';
import { AstrologyGuide, AstrologyGuideSchema, PlanetProfile, PlanetProfileSchema, MoonSignProfile, MoonSignProfileSchema } from './schemas/astrology-content.schema';
import { AstrologyContentService } from './services/astrology-content.service';
import { NumerologyService } from './services/numerology.service';
import { CompatibilityLogicService } from './services/compatibility-logic.service';
import { SmartKundliPdfService } from './services/smart-kundli-pdf.service';
import { CompatibilitySettingsModule } from '../compatibility-settings/compatibility-settings.module';
import { AdminModule } from '../admin/admin.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MuhuratCategory.name, schema: MuhuratCategorySchema },
      { name: MuhuratManualDate.name, schema: MuhuratManualDateSchema },
      { name: AstrologyHistory.name, schema: AstrologyHistorySchema },
      { name: AstrologyGuide.name, schema: AstrologyGuideSchema },
      { name: PlanetProfile.name, schema: PlanetProfileSchema },
      { name: MoonSignProfile.name, schema: MoonSignProfileSchema },
    ]),
    forwardRef(() => AiAstrologersModule),
    forwardRef(() => AdminModule),
    CompatibilitySettingsModule,
    UploadModule,
  ],

  controllers: [AstrologyController, MuhuratAdminController],
  providers: [MuhuratService, AstrologyHistoryService, AstrologyContentService, NumerologyService, CompatibilityLogicService, SmartKundliPdfService],
  exports: [MuhuratService, AstrologyHistoryService, AstrologyContentService, NumerologyService, CompatibilityLogicService, SmartKundliPdfService],
})
export class AstrologyModule {}

