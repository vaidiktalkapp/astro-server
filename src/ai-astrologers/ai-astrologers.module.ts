import { Module, forwardRef } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';
import { AiAstrologersController } from './controllers/ai-astrologers.controller';
import { AiOrdersController } from './controllers/ai-orders.controller';
import { AiHistoryController } from './controllers/ai-history.controller';
import { AiChatSessionService } from './services/chat-session.service';
import { AiAstrologyEngineService } from './services/ai-astrology-engine.service';
import { AiAnalyticsService } from './services/ai-analytics.service';
import { AstronomyService } from './services/astronomy.service';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../chat/schemas/chat-message.schema';
import { AiAstrologerProfile, AiAstrologerProfileSchema } from './schemas/ai-astrologers-profile.schema';
import { WalletTransaction, WalletTransactionSchema } from '../payments/schemas/wallet-transaction.schema';
import { CallSession, CallSessionSchema } from '../calls/schemas/call-session.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Order, OrderSchema } from '../orders/schemas/orders.schema';
import { SystemSettings, SystemSettingsSchema } from '../payments/schemas/system-settings.schema';
import { AdminModule } from '../admin/admin.module';
import { UploadModule } from '../upload/upload.module';
import { AiChatGateway } from './gateways/ai-chat.gateway';
import { AstrologersModule } from '../astrologers/astrologers.module';
import { HoroscopeModule } from '../horoscope/horoscope.module';
import { LalKitabSettingsModule } from '../lal-kitab-settings/lal-kitab-settings.module';
import { AstrologyModule } from '../astrology/astrology.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ChatSession.name, schema: ChatSessionSchema },
            { name: ChatMessage.name, schema: ChatMessageSchema },
            { name: AiAstrologerProfile.name, schema: AiAstrologerProfileSchema },
            { name: WalletTransaction.name, schema: WalletTransactionSchema },
            { name: User.name, schema: UserSchema },
            { name: Order.name, schema: OrderSchema },
            { name: CallSession.name, schema: CallSessionSchema },
            { name: SystemSettings.name, schema: SystemSettingsSchema },
        ]), 
        forwardRef(() => AdminModule),
        UploadModule,
        forwardRef(() => AstrologersModule),
        HoroscopeModule,
        LalKitabSettingsModule,
        forwardRef(() => AstrologyModule),
    ],
    controllers: [
        AiAstrologersController, 
        AiOrdersController, 
        AiHistoryController
    ],
    providers: [
        AiChatSessionService,
        AiAstrologyEngineService,
        AstronomyService,
        AiChatGateway,
        AiAnalyticsService,
    ],
    exports: [AiChatSessionService, AiAstrologyEngineService, AstronomyService, MongooseModule],
})
export class AiAstrologersModule { }
