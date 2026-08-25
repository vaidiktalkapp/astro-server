import { Controller, Post, Body } from '@nestjs/common';
import { ContactInquiriesService } from '../services/contact-inquiries.service';
import { CreateContactInquiryDto } from '../dto/create-contact-inquiry.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Contact Inquiries')
@Controller('contact-us')
export class ContactInquiriesController {
  constructor(private readonly service: ContactInquiriesService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new contact inquiry' })
  async create(@Body() createDto: CreateContactInquiryDto) {
    const inquiry = await this.service.create(createDto);
    return { success: true, message: 'Message sent successfully', data: inquiry };
  }
}
