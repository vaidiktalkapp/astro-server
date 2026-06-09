// src/calls/calls.module.ts

import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallController } from './controllers/calls.controller';
import { CallGateway } from './gateways/calls.gateway';
import { CallSessionService } from './services/call-session.service';
import { CallRecordingService } from './services/call-recording.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { AgoraService } from './services/agora.service'; 
import { CallBillingService } from './services/call-billing.service'; 
import { CallSession, CallSessionSchema } from './schemas/call-session.schema';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { OrdersModule } from '../orders/orders.module';
import { AiAstrologerProfile, AiAstrologerProfileSchema } from '../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { PaymentsModule } from '../payments/payments.module';
import { AstrologersModule } from '../astrologers/astrologers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Astrologer, AstrologerSchema } from '../astrologers/schemas/astrologer.schema';
import { EarningsService } from '../astrologers/services/earnings.service';
import { UsersModule } from '../users/users.module';
import { AiVoiceModule } from '../ai-voice/ai-voice.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallSession.name, schema: CallSessionSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: User.name, schema: UserSchema },
      { name: Astrologer.name, schema: AstrologerSchema },
      { name: AiAstrologerProfile.name, schema: AiAstrologerProfileSchema },
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => AstrologersModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => ChatModule),
    forwardRef(() => AiVoiceModule),
    UsersModule,
  ],
  controllers: [CallController],
  providers: [
    CallGateway,
    CallSessionService,
    CallRecordingService,
    SessionCleanupService,
    AgoraService, 
    CallBillingService, 
    EarningsService,
  ],
  exports: [CallSessionService, CallRecordingService, AgoraService, CallBillingService],
})
export class CallsModule { }
