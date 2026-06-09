// src/chat/chat.module.ts

import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatSessionService } from './services/chat-session.service';
import { ChatMessageService } from './services/chat-message.service';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatMessageFeedback, ChatMessageFeedbackSchema } from './schemas/chat-message-feedback.schema';
import { ChatMessageFeedbackService } from './services/chat-message-feedback.service';
import { ChatMessageFeedbackController } from './controllers/chat-message-feedback.controller';
import { Order, OrderSchema } from '../orders/schemas/orders.schema';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AstrologersModule } from '../astrologers/astrologers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Astrologer, AstrologerSchema } from '../astrologers/schemas/astrologer.schema';
import { EarningsService } from '../astrologers/services/earnings.service';
import { UploadModule } from '../upload/upload.module';
import { UsersModule } from '../users/users.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Astrologer.name, schema: AstrologerSchema },
      { name: ChatMessageFeedback.name, schema: ChatMessageFeedbackSchema },
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => AstrologersModule),
    forwardRef(() => NotificationsModule),
    UploadModule,
    UsersModule,
  ],
  controllers: [ChatController, ChatMessageFeedbackController],
  providers: [ChatGateway, ChatSessionService, ChatMessageService, EarningsService, ChatMessageFeedbackService],
  exports: [ChatSessionService, ChatMessageService, ChatGateway, ChatMessageFeedbackService],
})
export class ChatModule { }
