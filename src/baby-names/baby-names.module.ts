import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BabyName, BabyNameSchema } from './schemas/baby-name.schema';
import { BabyNameService } from './services/baby-name.service';
import { BabyNameController } from './controllers/baby-name.controller';
import { BabyNameAdminController } from './controllers/baby-name-admin.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BabyName.name, schema: BabyNameSchema },
    ]),
    forwardRef(() => AdminModule),
  ],

  controllers: [BabyNameController, BabyNameAdminController],
  providers: [BabyNameService],
  exports: [BabyNameService],
})
export class BabyNamesModule {}
