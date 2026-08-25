import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactInquiry, ContactInquiryDocument } from '../schemas/contact-inquiry.schema';
import { CreateContactInquiryDto } from '../dto/create-contact-inquiry.dto';

@Injectable()
export class ContactInquiriesService {
  constructor(
    @InjectModel(ContactInquiry.name)
    private contactInquiryModel: Model<ContactInquiryDocument>,
  ) {}

  async create(createDto: CreateContactInquiryDto): Promise<ContactInquiry> {
    const inquiry = new this.contactInquiryModel(createDto);
    return inquiry.save();
  }

  async findAll(status?: string): Promise<ContactInquiry[]> {
    const filter = status ? { status } : {};
    return this.contactInquiryModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(id: string, status: string, notes?: string): Promise<ContactInquiry> {
    const inquiry = await this.contactInquiryModel.findByIdAndUpdate(
      id,
      { status, ...(notes && { notes }) },
      { new: true },
    );
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }
    return inquiry;
  }
}
