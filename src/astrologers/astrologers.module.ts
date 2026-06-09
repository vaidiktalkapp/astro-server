import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt'; // ✅ ADD

// Schemas
import { Astrologer, AstrologerSchema } from './schemas/astrologer.schema';
import { ProfileChangeRequest, ProfileChangeRequestSchema } from './schemas/profile-change-request.schema';
import { CallSession, CallSessionSchema } from '../calls/schemas/call-session.schema';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { AiAstrologerProfile, AiAstrologerProfileSchema } from '../ai-astrologers/schemas/ai-astrologers-profile.schema'; // ✅ ADD

// Services
import { AstrologersService } from './services/astrologers.service';
import { AstrologerService } from './services/astrologer.service'; // ✅ ADD (you're using it in controller)
import { AvailabilityService } from './services/availability.service';
import { ProfileChangeService } from './services/profile-change.service';
import { EarningsService } from './services/earnings.service';
import { PenaltyService } from './services/penalty.service';
import { RatingReviewService } from './services/rating-review.service';

// Controllers
import { AstrologersController } from './controllers/astrologers.controller';
import { AstrologerProfileController } from './controllers/astrologer-profile.controller';

import { AstrologerBlockingController } from './controllers/astrologer-blocking.controller'; // ✅ ADD
import { AstrologerBlockingService } from './services/astrologer-blocking.service'; // ✅ ADD

// ✅ Import UsersModule for UserBlockingService
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from 'src/auth/auth.module';
import { AiAstrologersModule } from 'src/ai-astrologers/ai-astrologers.module'; // ✅ ADD
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Order, OrderSchema } from 'src/orders/schemas/orders.schema';
import { RegistrationModule } from '../registration/registration.module'; // ✅ ADD

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Astrologer.name, schema: AstrologerSchema },
      { name: ProfileChangeRequest.name, schema: ProfileChangeRequestSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: CallSession.name, schema: CallSessionSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: AiAstrologerProfile.name, schema: AiAstrologerProfileSchema }, // ✅ ADD
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }), // ✅ ADD for JWT verification in controller
    UsersModule, // ✅ This imports UserBlockingService
    AuthModule, // ✅ This imports JWT services
    forwardRef(() => PaymentsModule),
    forwardRef(() => AiAstrologersModule), // ✅ ADD
    RegistrationModule, // ✅ ADD
  ],
  controllers: [
    AstrologersController,
    AstrologerProfileController,
    AstrologerBlockingController, // ✅ ADD
  ],
  providers: [
    AstrologersService,
    AstrologerService, // ✅ ADD (you're using it in AstrologerProfileController)
    AvailabilityService,
    ProfileChangeService,
    EarningsService,
    PenaltyService,
    RatingReviewService,
    AstrologerBlockingService, // ✅ ADD
  ],
  exports: [
    AstrologersService,
    AstrologerService, // ✅ ADD
    AvailabilityService,
    EarningsService,
    PenaltyService,
    MongooseModule,
    RatingReviewService,
    AstrologerBlockingService, // ✅ ADD
  ],
})
export class AstrologersModule { }
