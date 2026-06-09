import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbuseReport, AbuseReportDocument } from '../schemas/abuse-report.schema';

@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(AbuseReport.name) private reportModel: Model<AbuseReportDocument>,
  ) {}

  async createReport(data: {
    reporterId: string;
    reporterModel: 'User' | 'Astrologer';
    reportedUserId: string;
    entityType: string;
    entityId?: string;
    reason: string;
    description?: string;
  }) {
    const reportId = `ABUSE-${Date.now()}`;

    const newReport = new this.reportModel({
      reportId,
      reporterId: new Types.ObjectId(data.reporterId),
      reporterModel: data.reporterModel,
      reportedEntityId: new Types.ObjectId(data.reportedUserId), // The target
      entityType: data.entityType,
      contextId: data.entityId,
      reason: data.reason,
      description: data.description,
    });

    await newReport.save();

    return {
      success: true,
      message: 'Report submitted successfully. We will review it shortly.',
      reportId,
    };
  }
}