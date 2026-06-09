import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessageFeedback, ChatMessageFeedbackDocument } from '../schemas/chat-message-feedback.schema';
import { CreateChatMessageFeedbackDto } from '../dto/create-chat-message-feedback.dto';

@Injectable()
export class ChatMessageFeedbackService {
  private readonly logger = new Logger(ChatMessageFeedbackService.name);

  constructor(
    @InjectModel(ChatMessageFeedback.name)
    private feedbackModel: Model<ChatMessageFeedbackDocument>,
  ) {}

  async createFeedback(userId: string, dto: CreateChatMessageFeedbackDto) {
    this.logger.log(`📝 [Feedback] Saving ${dto.type} for message ${dto.messageId}`);

    const filter = { messageId: dto.messageId, userId: new Types.ObjectId(userId) };
    const update = {
      ...dto,
      userId: new Types.ObjectId(userId),
      astrologerId: dto.astrologerId ? new Types.ObjectId(dto.astrologerId) : undefined,
    };

    // Upsert: One user can give one feedback per message
    return this.feedbackModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  async getAnalytics(astrologerId?: string) {
    const match: any = {};
    if (astrologerId) {
      match.astrologerId = new Types.ObjectId(astrologerId);
    }

    return this.feedbackModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);
  }
}
