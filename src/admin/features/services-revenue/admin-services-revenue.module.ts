import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminServicesRevenueController } from './controllers/admin-services-revenue.controller';
import { AdminServicesRevenueService } from './services/admin-services-revenue.service';
import { WalletTransaction, WalletTransactionSchema } from '../../../payments/schemas/wallet-transaction.schema';
import { User, UserSchema } from '../../../users/schemas/user.schema';
import { Astrologer, AstrologerSchema } from '../../../astrologers/schemas/astrologer.schema';
import { MatrimonyChatOrder, MatrimonyChatOrderSchema } from '../../../matrimony/schemas/matrimony-chat-order.schema';
import { Report, ReportSchema } from '../../../reports/schemas/reports.schema';
import { Order, OrderSchema } from '../../../orders/schemas/orders.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Admin, AdminSchema } from '../../core/schemas/admin.schema';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('ADMIN_JWT_SECRET') || 'fby34f82y34bfuibetheryjh5h6554u',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Astrologer.name, schema: AstrologerSchema },
      { name: MatrimonyChatOrder.name, schema: MatrimonyChatOrderSchema },
      { name: Report.name, schema: ReportSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [AdminServicesRevenueController],
  providers: [AdminServicesRevenueService],
  exports: [AdminServicesRevenueService],
})
export class AdminServicesRevenueModule {}
