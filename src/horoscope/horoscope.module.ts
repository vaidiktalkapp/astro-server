import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HoroscopeController } from './horoscope.controller';
import { HoroscopeService } from './horoscope.service';
import { AdminModule } from '../admin/admin.module';

import { LoveHoroscopeSchema } from './schemas/love-horoscope.schema';
import { LoveHoroscopeCacheSchema } from './schemas/love-horoscope-cache.schema';
import { ChineseZodiacProfileSchema } from './schemas/chinese-zodiac-profile.schema';
import { ZodiacProfileSchema } from './schemas/zodiac-profile.schema';
import { ChineseHoroscopeSchema } from './schemas/chinese-horoscope.schema';
import { ChineseHoroscopeCacheSchema } from './schemas/chinese-horoscope-cache.schema';

@Module({
  imports: [
    forwardRef(() => AdminModule),
    MongooseModule.forFeature([

      { name: 'LoveHoroscope', schema: LoveHoroscopeSchema },
      { name: 'LoveHoroscopeCache', schema: LoveHoroscopeCacheSchema },
      { name: 'ZodiacProfile', schema: ZodiacProfileSchema },
      { name: 'ChineseZodiacProfile', schema: ChineseZodiacProfileSchema },
      { name: 'ChineseHoroscope', schema: ChineseHoroscopeSchema },
      { name: 'ChineseHoroscopeCache', schema: ChineseHoroscopeCacheSchema },
    ]),
  ],
  controllers: [HoroscopeController],
  providers: [HoroscopeService],
  exports: [HoroscopeService],
})
export class HoroscopeModule {}
