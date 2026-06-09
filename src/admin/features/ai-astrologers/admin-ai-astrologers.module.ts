import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AdminAiAstrologersController } from './controllers/admin-ai-astrologers.controller';
import { AdminAiAstrologersService } from './services/admin-ai-astrologers.service';
import { AiAstrologerProfile, AiAstrologerProfileSchema } from '../../../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { ChatSession, ChatSessionSchema } from '../../../chat/schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../../../chat/schemas/chat-message.schema';
import { WalletTransaction, WalletTransactionSchema } from '../../../payments/schemas/wallet-transaction.schema';
import { Admin, AdminSchema } from '../../core/schemas/admin.schema';
import { User, UserSchema } from '../../../users/schemas/user.schema';
import { CallSession, CallSessionSchema } from '../../../calls/schemas/call-session.schema';
import { AdminNotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        ConfigModule,
        AdminNotificationsModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('ADMIN_JWT_SECRET') || 'fby34f82y34bfuibetheryjh5h6554u',
                signOptions: { expiresIn: '7d' },
            }),
        }),
        MongooseModule.forFeature([
            { name: AiAstrologerProfile.name, schema: AiAstrologerProfileSchema },
            { name: ChatSession.name, schema: ChatSessionSchema },
            { name: ChatMessage.name, schema: ChatMessageSchema },
            { name: WalletTransaction.name, schema: WalletTransactionSchema },
            { name: Admin.name, schema: AdminSchema },
            { name: User.name, schema: UserSchema },
            { name: CallSession.name, schema: CallSessionSchema }
        ])
    ],
    controllers: [AdminAiAstrologersController],
    providers: [AdminAiAstrologersService],
    exports: [AdminAiAstrologersService]
})
export class AdminAiAstrologersModule { }
