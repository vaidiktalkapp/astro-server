import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import configuration files
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import jwtConfig from './config/jwt.config';

// Import modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AstrologersModule } from './astrologers/astrologers.module';
import { ChatModule } from './chat/chat.module';
import { CallsModule } from './calls/calls.module';
import { StreamingModule } from './streaming/streaming.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { RemediesModule } from './remedies/remedies.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RegistrationModule } from './registration/registration.module';
import { UploadModule } from './upload/upload.module';
import { ShopifyModule } from './shopify/shopify.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AstrologyModule } from './astrology/astrology.module';


import { ScheduleModule } from '@nestjs/schedule';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { ModerationModule } from './moderation/moderation.module';
import { AiAstrologersModule } from './ai-astrologers/ai-astrologers.module';
import { AiVoiceModule } from './ai-voice/ai-voice.module';
import { HoroscopeModule } from './horoscope/horoscope.module';
import { OccultDirectoryModule } from './occult-directory/occult-directory.module';
import { BabyNamesModule } from './baby-names/baby-names.module';
import { CompatibilitySettingsModule } from './compatibility-settings/compatibility-settings.module';
import { LalKitabSettingsModule } from './lal-kitab-settings/lal-kitab-settings.module';
import { FestivalsModule } from './festivals/festivals.module';
import { HealingModule } from './healing/healing.module';
import { FreeToolSettingsModule } from './free-tool-settings/free-tool-settings.module';
import { CelebrityModule } from './celebrity/celebrity.module';
import { MatrimonyModule } from './matrimony/matrimony.module';
import { BlogsModule } from './blogs/blogs.module';
import { PdfPricingModule } from './pdf-pricing/pdf-pricing.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { FaqsModule } from './faqs/faqs.module';
import { PujasModule } from './pujas/pujas.module';
import { BannersModule } from './banners/banners.module';
import { SmartKundaliSettingsModule } from './smart-kundali-settings/smart-kundali-settings.module';
import { PujaBookingsModule } from './puja-bookings/puja-bookings.module';
import { ReportBookingsModule } from './report-bookings/report-bookings.module';
import { HeroSettingsModule } from './hero-settings/hero-settings.module';
import { SeoSettingsModule } from './seo-settings/seo-settings.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { PageSeoSettingsModule } from './page-seo-settings/page-seo-settings.module';
import { MenusModule } from './menus/menus.module';

@Module({
  imports: [
    // Global configuration
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig],
      envFilePath: '.env',
    }),
    SeoSettingsModule,
    HoroscopeModule,
    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        ...configService.get('database.options'),
      }),
      inject: [ConfigService],
    }),

    // FIXED Redis cache connection
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        try {
          const redisUrl = configService.get<string>('REDIS_URL');
          let store;

          if (redisUrl) {
            // 🔹 Use Upstash/Render Redis
            store = await redisStore({
              url: redisUrl,
              ttl: 300,
              socket: {
                tls: redisUrl.startsWith('rediss://'), // enable TLS for Upstash
              },
              keyPrefix: 'vaidiktalk:',
            });
            console.log('✅ Connected to remote Redis:', redisUrl);
          } else {
            // 🔹 Fallback to local Redis
            store = await redisStore({
              socket: {
                host: configService.get<string>('REDIS_HOST') || 'localhost',
                port: configService.get<number>('REDIS_PORT') || 6379,
              },
              ttl: 300,
              database: 0,
              keyPrefix: 'vaidiktalk:',
            });
            console.log('✅ Connected to local Redis');
          }

          return { store: () => store };
        } catch (error) {
          console.error('❌ Redis connection failed:', error.message);
          console.log('🔄 Falling back to in-memory cache');
          return { ttl: 300 };
        }
      },
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    AstrologersModule,
    ChatModule,
    CallsModule,
    StreamingModule,
    AdminModule,
    PaymentsModule,
    OrdersModule,
    RemediesModule,
    ReportsModule,
    NotificationsModule,
    RegistrationModule,
    UploadModule,
    ShopifyModule,
    SupportModule,
    BankAccountsModule,
    TransactionsModule,
    RemediesModule,
    ModerationModule,
    AiAstrologersModule,
    AiVoiceModule,
    AstrologyModule,
    OccultDirectoryModule,
    BabyNamesModule,
    CompatibilitySettingsModule,
    LalKitabSettingsModule,
    FestivalsModule,
    HealingModule,
    FreeToolSettingsModule,
    CelebrityModule,
    MatrimonyModule,
    PdfPricingModule,
    TestimonialsModule,
    BlogsModule,
    FaqsModule,
    PujasModule,
    BannersModule,
    SmartKundaliSettingsModule,
    PujaBookingsModule,
    ReportBookingsModule,
    HeroSettingsModule,
    SubscribersModule,
    PageSeoSettingsModule,
    MenusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule { }
