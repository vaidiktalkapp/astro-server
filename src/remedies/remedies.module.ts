import { Module, forwardRef } from '@nestjs/common'; // ✅ Import forwardRef
import { MongooseModule } from '@nestjs/mongoose';
import { RemediesController } from './controllers/remedies.controller';
import { AstrologerRemediesController } from './controllers/astrologer-remedies.controller';
import { RemediesService } from './services/remedies.service';
import { Remedy, RemedySchema } from './schemas/remedies.schema';
import { Order, OrderSchema } from '../orders/schemas/orders.schema';
import { ShopifyModule } from '../shopify/shopify.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Remedy.name, schema: RemedySchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    forwardRef(() => ShopifyModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [RemediesController, AstrologerRemediesController],
  providers: [RemediesService],
  exports: [RemediesService],
})
export class RemediesModule { }
