// src/admin/features/review-moderation/services/admin-review-moderation.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../../../../orders/schemas/orders.schema';
import { Review, ReviewDocument } from '../../../../reviews/schemas/review.schema';
import { RatingReviewService } from '../../../../astrologers/services/rating-review.service';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../../../../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { Astrologer, AstrologerDocument } from '../../../../astrologers/schemas/astrologer.schema';

@Injectable()
export class AdminReviewModerationService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(AiAstrologerProfile.name) private aiAstrologerModel: Model<AiAstrologerProfileDocument>,
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    private ratingReviewService: RatingReviewService,
  ) {}

  /**
   * ✅ Get reviews for moderation
   */
  async getReviewsForModeration(
    page = 1,
    limit = 20,
    status: 'pending' | 'approved' | 'rejected' | 'flagged' | 'all' = 'pending',
  ): Promise<any> {
    const skip = (page - 1) * limit;
    
    // ✅ Build query for Review collection
    const filter: any = { isDeleted: false };
    
    if (status !== 'all') {
      filter.moderationStatus = status;
    }

    const [rawReviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('userId', 'name phoneNumber profileImage')
        .populate('moderatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);

    const astrologerIds = [...new Set(rawReviews.map(r => r.astrologerId?.toString()).filter(Boolean))];
    
    const [astrologers, aiAstrologers] = await Promise.all([
      this.astrologerModel.find({ _id: { $in: astrologerIds } }).select('name email profilePicture ratings').lean(),
      this.aiAstrologerModel.find({ _id: { $in: astrologerIds } }).select('name profilePicture rating').lean()
    ]);

    const astrologerMap = new Map();
    astrologers.forEach((a: any) => astrologerMap.set(a._id.toString(), a));
    aiAstrologers.forEach((a: any) => astrologerMap.set(a._id.toString(), {
      _id: a._id,
      name: a.name,
      email: '',
      profilePicture: a.image,
      ratings: { average: a.rating || 0 }
    }));

    const reviews = rawReviews.map(r => ({
      ...r,
      astrologerId: astrologerMap.get(r.astrologerId?.toString()) || r.astrologerId
    }));

    return {
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ Approve review
   */
  async approveReview(reviewId: string, adminId: Types.ObjectId) {
    const review = await this.reviewModel.findOne({ reviewId });
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.moderationStatus = 'approved';
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();

    // ✅ Update astrologer ratings with approved review
    await this.ratingReviewService.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review approved',
    };
  }

  /**
   * ✅ Reject review
   */
  async rejectReview(reviewId: string, adminId: Types.ObjectId, reason: string) {
    const review = await this.reviewModel.findOne({ reviewId });
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.moderationStatus = 'rejected';
    review.moderationReason = reason;
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();

    // ✅ Update astrologer ratings (removes rejected review from calculation)
    await this.ratingReviewService.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review rejected',
    };
  }

  /**
   * ✅ Flag review
   */
  async flagReview(reviewId: string, adminId: Types.ObjectId, reason: string) {
    const review = await this.reviewModel.findOne({ reviewId });
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.moderationStatus = 'flagged';
    review.moderationReason = reason;
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();

    return {
      success: true,
      message: 'Review flagged for manual review',
    };
  }

  /**
   * ✅ Get moderation stats
   */
  async getModerationStats() {
    const stats = await this.reviewModel.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$moderationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id || 'pending'] = stat.count;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        pending: statsMap.pending || 0,
        approved: statsMap.approved || 0,
        rejected: statsMap.rejected || 0,
        flagged: statsMap.flagged || 0,
        total: Object.values(statsMap).reduce((a: number, b: number) => a + b, 0),
      },
    };
  }

  /**
   * ✅ Get review details
   */
  async getReviewDetails(reviewId: string): Promise<any> {
    let review = await this.reviewModel
      .findOne({ reviewId })
      .populate('userId', 'name email phoneNumber profileImage')
      .populate('moderatedBy', 'name email')
      .lean();

    if (review) {
      const astId = review.astrologerId?.toString();
      if (astId) {
        let ast = await this.astrologerModel.findById(astId).select('name profilePicture ratings').lean();
        if (!ast) {
          const aiAst = await this.aiAstrologerModel.findById(astId).select('name image rating').lean();
          if (aiAst) {
            ast = {
              _id: aiAst._id,
              name: aiAst.name,
              profilePicture: (aiAst as any).image,
              ratings: { average: (aiAst as any).rating || 0 }
            } as any;
          }
        }
        (review as any).astrologerId = ast || review.astrologerId;
      }
    }

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Get order details
    const order = await this.orderModel
      .findOne({ orderId: review.orderId })
      .select('orderId type status totalAmount createdAt')
      .lean();

    return {
      success: true,
      data: {
        review,
        order,
      },
    };
  }
  /**
   * ✅ Edit review
   */
  async editReview(reviewId: string, adminId: Types.ObjectId, updateData: any) {
    const review = await this.reviewModel.findOne({ reviewId });
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (updateData.rating !== undefined) {
      review.rating = Number(updateData.rating);
    }
    if (updateData.reviewText !== undefined) {
      review.reviewText = updateData.reviewText;
    }
    if (updateData.reviewDate !== undefined) {
      review.reviewDate = new Date(updateData.reviewDate);
    }
    if (review.isTestData) {
      if (updateData.userName !== undefined) review.testUserName = updateData.userName;
      if (updateData.userImage !== undefined) review.testUserImage = updateData.userImage;
      if (updateData.serviceType !== undefined) review.serviceType = updateData.serviceType;
    }

    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();

    // ✅ Update astrologer ratings
    await this.ratingReviewService.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review updated successfully',
      data: review,
    };
  }

  /**
   * ✅ Delete review (Soft delete)
   */
  async deleteReview(reviewId: string, adminId: Types.ObjectId) {
    const review = await this.reviewModel.findOne({ reviewId });
    
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isDeleted = true;
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();

    // ✅ Update astrologer ratings (removes deleted review from calculation)
    await this.ratingReviewService.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review deleted successfully',
    };
  }
}
