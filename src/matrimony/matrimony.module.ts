import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatrimonyProfile, MatrimonyProfileSchema } from './schemas/matrimony-profile.schema';
import { MatrimonyService } from './services/matrimony.service';
import { MatrimonyController } from './controllers/matrimony.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AiAstrologersModule } from '../ai-astrologers/ai-astrologers.module';
import { MatrimonyInterest, MatrimonyInterestSchema } from './schemas/matrimony-interest.schema';
import { MatrimonyMessage, MatrimonyMessageSchema } from './schemas/matrimony-message.schema';
import { MatrimonyChatSettings, MatrimonyChatSettingsSchema } from './schemas/matrimony-chat-settings.schema';
import { MatrimonyChatOrder, MatrimonyChatOrderSchema } from './schemas/matrimony-chat-order.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatrimonyChatService } from './services/matrimony-chat.service';
import { MatrimonyChatGateway } from './gateways/matrimony-chat.gateway';
import { MatrimonyChatController } from './controllers/matrimony-chat.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatrimonyProfile.name, schema: MatrimonyProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: MatrimonyInterest.name, schema: MatrimonyInterestSchema },
      { name: MatrimonyMessage.name, schema: MatrimonyMessageSchema },
      { name: MatrimonyChatSettings.name, schema: MatrimonyChatSettingsSchema },
      { name: MatrimonyChatOrder.name, schema: MatrimonyChatOrderSchema },
    ]),
    AiAstrologersModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => AdminModule),
  ],
  controllers: [MatrimonyController, MatrimonyChatController],
  providers: [MatrimonyService, MatrimonyChatService, MatrimonyChatGateway],
  exports: [MatrimonyService],
})
export class MatrimonyModule {}
