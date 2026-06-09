import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealingController } from './healing.controller';
import { HealingService } from './healing.service';
import { HealingItem, HealingItemSchema } from './schemas/healing-item.schema';
import { AdminModule } from '../admin/admin.module';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealingItem.name, schema: HealingItemSchema },
    ]),
    forwardRef(() => AdminModule),

  ],
  controllers: [HealingController],
  providers: [HealingService],
  exports: [HealingService],
})
export class HealingModule {}
