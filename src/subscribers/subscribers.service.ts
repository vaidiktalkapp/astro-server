import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';

@Injectable()
export class SubscribersService {
  constructor(
    @InjectModel(Subscriber.name) private subscriberModel: Model<SubscriberDocument>,
  ) {}

  async create(createSubscriberDto: CreateSubscriberDto): Promise<Subscriber> {
    const existing = await this.subscriberModel.findOne({ email: createSubscriberDto.email });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        return existing.save();
      }
      return existing; // Already subscribed, just return it
    }
    const newSubscriber = new this.subscriberModel(createSubscriberDto);
    return newSubscriber.save();
  }

  async findAll(): Promise<Subscriber[]> {
    return this.subscriberModel.find().sort({ createdAt: -1 }).exec();
  }

  async remove(id: string): Promise<any> {
    return this.subscriberModel.findByIdAndDelete(id).exec();
  }
}
