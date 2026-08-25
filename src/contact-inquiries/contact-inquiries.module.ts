import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactInquiry, ContactInquirySchema } from './schemas/contact-inquiry.schema';
import { ContactInquiriesService } from './services/contact-inquiries.service';
import { ContactInquiriesController } from './controllers/contact-inquiries.controller';
import { AdminContactInquiriesController } from './controllers/admin-contact-inquiries.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactInquiry.name, schema: ContactInquirySchema },
    ]),
  ],
  controllers: [ContactInquiriesController, AdminContactInquiriesController],
  providers: [ContactInquiriesService],
})
export class ContactInquiriesModule {}
