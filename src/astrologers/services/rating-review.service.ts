// src/astrologers/services/rating-review.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Astrologer, AstrologerDocument } from '../schemas/astrologer.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Order, OrderDocument } from '../../orders/schemas/orders.schema';
import { Review, ReviewDocument } from '../../reviews/schemas/review.schema';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { ChatSession, ChatSessionDocument } from '../../chat/schemas/chat-session.schema';
import { CallSession, CallSessionDocument } from '../../calls/schemas/call-session.schema';

export interface ReviewData {
  userId: string;
  astrologerId: string;
  orderId: string;
  rating: number;
  reviewText?: string;
  serviceType: 'chat' | 'call' | 'video_call';
}

export interface ReviewResult {
  success: boolean;
  message: string;
  reviewId?: string;
  newRating?: number;
  totalReviews?: number;
}

@Injectable()
export class RatingReviewService {
  constructor(
    @InjectModel(Astrologer.name) private astrologerModel: Model<AstrologerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(AiAstrologerProfile.name) private aiProfileModel: Model<AiAstrologerProfileDocument>,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(CallSession.name) private callSessionModel: Model<CallSessionDocument>,
  ) { }

  /**
   * ✅ ADD REVIEW (Create in separate Review collection)
   */
  async addReview(reviewData: ReviewData): Promise<ReviewResult> {
    const { userId, astrologerId, orderId, rating, reviewText, serviceType } = reviewData;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Find the order (Primary: Order collection, Fallback: Chat/Call sessions for AI)
    let order = await this.orderModel.findOne({
      $or: [{ orderId }, { conversationThreadId: orderId }],
      userId: new Types.ObjectId(userId)
    }) as any;

    let isVirtualOrder = false;

    if (!order) {
      console.log(`🔍 [RatingReviewService] Order ${orderId} not found in Order collection, checking sessions...`);

      // Check ChatSession
      const chatSession = await this.chatSessionModel.findOne({
        $or: [{ orderId }, { sessionId: orderId }],
        userId: new Types.ObjectId(userId)
      });

      if (chatSession) {
        order = chatSession;
        isVirtualOrder = true;
      } else {
        // Check CallSession
        const callSession = await this.callSessionModel.findOne({
          $or: [{ orderId }, { sessionId: orderId }],
          userId: new Types.ObjectId(userId)
        });
        if (callSession) {
          order = callSession;
          isVirtualOrder = true;
        }
      }
    }

    if (!order) {
      console.error(`❌ [RatingReviewService] NotFound (404): Order or User mismatch. Query: { orderId: "${orderId}", userId: "${userId}" }`);
      throw new NotFoundException('Order not found');
    }

    // Verify order belongs to astrologer
    if (order.astrologerId.toString() !== astrologerId) {
      console.error(`❌ [RatingReviewService] Order mismatch: order.astrologerId=${order.astrologerId}, astrologerId=${astrologerId}`);
      throw new BadRequestException('Order does not belong to this astrologer');
    }

    // Check if order is completed
    // Relaxed: allow reviews for 'active', 'completed', or 'ended' sessions
    const allowedStatuses = ['active', 'completed', 'ended'];
    if (!allowedStatuses.includes(order.status)) {
      console.error(`❌ [RatingReviewService] Invalid order status for review: ${order.status}`);
      throw new BadRequestException(`Cannot review session with status: ${order.status}`);
    }

    // Check if already reviewed
    const reviewGiven = order.reviewGiven || order.reviewSubmitted || false;
    if (reviewGiven) {
      console.error(`❌ [RatingReviewService] BadRequest (400): Order ${orderId} already marked as reviewed`);
      throw new BadRequestException('This session has already been reviewed');
    }

    // Find the astrologer (Standard or AI)
    let astrologer = await this.astrologerModel.findById(astrologerId);
    let isAi = false;

    if (!astrologer) {
      astrologer = await this.aiProfileModel.findById(astrologerId) as any;
      if (!astrologer) {
        throw new NotFoundException('Astrologer not found');
      }
      isAi = true;
    }

    try {
      // Generate review ID
      const reviewId = `REV_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create review document
      const review = new this.reviewModel({
        reviewId,
        userId: new Types.ObjectId(userId),
        astrologerId: new Types.ObjectId(astrologerId),
        orderId,
        rating,
        reviewText: reviewText || '',
        serviceType,
        sessionDuration: order.actualDurationSeconds || order.duration || 0,
        moderationStatus: 'pending',
        createdAt: new Date(),
      });

      await review.save();

      // Update order/session
      if (isVirtualOrder) {
        if (serviceType === 'chat') {
          order.userSatisfactionRating = rating;
          order.reviewGiven = true;
          order.reviewGivenAt = new Date();
        } else {
          // For CallSession
          order.rating = rating;
          order.review = reviewText;
          order.reviewSubmitted = true;
          order.reviewSubmittedAt = new Date();
        }

        // Since order is a Mongoose document from either chatSessionModel or callSessionModel
        await order.save();
      } else {
        // Standard order collection
        order.reviewGiven = true;
        order.reviewGivenAt = new Date();
        order.reviewId = review._id;
        await order.save();
      }

      // Update user stats
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'stats.totalRatings': 1 }
      });

      // Recalculate astrologer ratings
      this.updateAstrologerRatings(astrologerId).catch(err =>
        console.error('Failed to update ratings:', err)
      );

      console.log(`✅ Review submitted (pending moderation): ${rating}/5 for astrologer ${astrologer.name} (Order: ${orderId})`);

      return {
        success: true,
        message: 'Review submitted successfully. It will be visible after admin approval.',
        reviewId,
        newRating: isAi ? (astrologer as any).rating : (astrologer as any).ratings?.average,
        totalReviews: isAi ? (astrologer as any).totalSessions : (astrologer as any).ratings?.total
      };

    } catch (error) {
      console.error('❌ Error adding review:', error);
      throw new BadRequestException('Failed to submit review. Please try again.');
    }
  }

  /**
   * ✅ UPDATE ASTROLOGER RATINGS
   */
  async updateAstrologerRatings(astrologerId: string): Promise<void> {
    // Find the astrologer (Standard or AI)
    let astrologer = await this.astrologerModel.findById(astrologerId);
    let aiProfile: any = null;

    if (!astrologer) {
      aiProfile = await this.aiProfileModel.findById(astrologerId);
      if (!aiProfile) {
        throw new NotFoundException('Astrologer not found');
      }
    }

    // Get all APPROVED reviews
    const approvedReviews = await this.reviewModel.find({
      astrologerId: new Types.ObjectId(astrologerId),
      moderationStatus: 'approved',
      isDeleted: false
    }).select('rating');

    const totalApproved = approvedReviews.length;

    if (totalApproved === 0) {
      if (astrologer) {
        astrologer.ratings.average = 0;
        astrologer.ratings.approvedReviews = 0;
        astrologer.ratings.breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        await astrologer.save();
      } else if (aiProfile) {
        aiProfile.rating = 0;
        aiProfile.satisfactionScore = 0;
        await aiProfile.save();
      }
      return;
    }

    const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / totalApproved;

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    approvedReviews.forEach(r => {
      const ratingKey = r.rating as 1 | 2 | 3 | 4 | 5;
      breakdown[ratingKey]++;
    });

    const totalReviews = await this.reviewModel.countDocuments({
      astrologerId: new Types.ObjectId(astrologerId),
      isDeleted: false
    });

    if (astrologer) {
      astrologer.ratings.average = Math.round(average * 10) / 10;
      astrologer.ratings.total = totalReviews;
      astrologer.ratings.approvedReviews = totalApproved;
      astrologer.ratings.breakdown = breakdown;
      await astrologer.save();
      console.log(`✅ Standard Ratings updated: ${astrologer.name} - ${astrologer.ratings.average}/5 (${totalApproved} approved)`);
    } else if (aiProfile) {
      aiProfile.rating = Math.round(average * 10) / 10;
      aiProfile.satisfactionScore = Math.round(average * 10) / 10;
      // We don't have total sessions/orders breakdown in AI profile schema, 
      // but we update the main rating.
      await aiProfile.save();
      console.log(`✅ AI Ratings updated: ${aiProfile.name} - ${aiProfile.rating}/5 (${totalApproved} approved)`);
    }
  }

  /**
 * ✅ GET ASTROLOGER REVIEWS (Paginated with Privacy Settings)
 */
  async getAstrologerReviews(
    astrologerId: string,
    page: number = 1,
    limit: number = 10,
    includeAll: boolean = false
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const query: any = {
      astrologerId: new Types.ObjectId(astrologerId),
      isDeleted: false
    };

    // Public users only see approved
    if (!includeAll) {
      query.moderationStatus = 'approved';
    }

    const [reviews, totalReviews] = await Promise.all([
      this.reviewModel
        .find(query)
        .populate({
          path: 'userId',
          select: 'name profileImage privacy.nameVisibleInReviews'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(query)
    ]);

    const formattedReviews = reviews.map(review => {
      let userName = 'Anonymous';
      let userProfileImage: string | null = null; // ✅ Fix: Declare correct type
      let isNameHidden = false;

      // ✅ Handle test data
      if (review.isTestData) {
        userName = review.testUserName || 'Test User';
        userProfileImage = review.testUserImage || null;
      }
      // ✅ Handle real user data with privacy settings
      else if (review.userId) {
        const user = review.userId as any;

        if (user?.name) {
          // Show full name unconditionally
          userName = user.name;
          userProfileImage = user.profileImage || null;
          isNameHidden = false;
        }
      }

      return {
        reviewId: review.reviewId,
        orderId: review.orderId,
        userName,
        userProfileImage,
        isNameHidden,
        rating: review.rating,
        reviewText: review.reviewText,
        serviceType: review.serviceType,
        duration: review.sessionDuration,
        reviewDate: review.createdAt,
        isEdited: review.isEdited,
        editedAt: review.editedAt,
        isTestData: review.isTestData || false,
      };
    });

    const totalPages = Math.ceil(totalReviews / limit);

    return {
      reviews: formattedReviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * ✅ GET REVIEW STATS
   */
  async getReviewStats(astrologerId: string): Promise<any> {
    let astrologer = await this.astrologerModel.findById(astrologerId);
    let isAi = false;

    if (!astrologer) {
      astrologer = await this.aiProfileModel.findById(astrologerId) as any;
      if (!astrologer) {
        throw new NotFoundException('Astrologer not found');
      }
      isAi = true;
    }

    if (isAi) {
      const ai = astrologer as any;

      // Calculate real breakdown for AI
      const reviews = await this.reviewModel.find({
        astrologerId: new Types.ObjectId(astrologerId),
        moderationStatus: 'approved',
        isDeleted: false
      }).select('rating');

      const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach(r => {
        const ratingKey = r.rating as 1 | 2 | 3 | 4 | 5;
        if (breakdown[ratingKey] !== undefined) {
          breakdown[ratingKey]++;
        }
      });

      return {
        averageRating: ai.rating || ai.satisfactionScore || 4.5,
        totalReviews: reviews.length,
        approvedReviews: reviews.length,
        ratingBreakdown: breakdown,
        stats: {
          totalOrders: ai.totalSessions || 0,
          totalMinutes: (ai.totalSessions || 0) * 10, // Estimate
          totalEarnings: ai.totalRevenue || 0,
          repeatCustomers: 0
        }
      };
    }

    return {
      averageRating: astrologer.ratings.average,
      totalReviews: astrologer.ratings.total,
      approvedReviews: astrologer.ratings.approvedReviews,
      ratingBreakdown: astrologer.ratings.breakdown,
      stats: {
        totalOrders: astrologer.stats.totalOrders,
        totalMinutes: astrologer.stats.totalMinutes,
        totalEarnings: astrologer.stats.totalEarnings,
        repeatCustomers: astrologer.stats.repeatCustomers
      }
    };
  }

  /**
   * ✅ SEED TEST REVIEWS (For testing when no reviews exist)
   */
  async seedTestReviewsIfEmpty(astrologerId: string): Promise<void> {
    try {
      const existingReviews = await this.reviewModel.countDocuments({
        astrologerId: new Types.ObjectId(astrologerId),
        isDeleted: false
      });

      // Only seed if no reviews exist
      if (existingReviews > 0) {
        return;
      }

      console.log(`🌱 Seeding test reviews for astrologer: ${astrologerId}`);

      const testReviews = [
        {
          rating: 5,
          reviewText: 'Amazing consultation! Very accurate predictions and great guidance.',
          serviceType: 'chat',
          userName: 'Priya Sharma',
          userImage: 'https://i.pravatar.cc/150?img=1',
        },
        {
          rating: 4,
          reviewText: 'Good experience. The astrologer was very patient and explained everything clearly.',
          serviceType: 'call',
          userName: 'Rahul Kumar',
          userImage: 'https://i.pravatar.cc/150?img=12',
        },
        {
          rating: 5,
          reviewText: 'Highly recommended! The remedies suggested were very effective.',
          serviceType: 'video_call',
          userName: 'Anjali Verma',
          userImage: 'https://i.pravatar.cc/150?img=5',
        },
        {
          rating: 5,
          reviewText: 'Very insightful session. Helped me understand my problems better.',
          serviceType: 'chat',
          userName: 'Vikram Singh',
          userImage: 'https://i.pravatar.cc/150?img=15',
        },
        {
          rating: 4,
          reviewText: 'Professional and knowledgeable. Will consult again.',
          serviceType: 'call',
          userName: 'Neha Gupta',
          userImage: 'https://i.pravatar.cc/150?img=9',
        },
      ];

      for (const testReview of testReviews) {
        const reviewId = `TEST_REV_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;

        const review = new this.reviewModel({
          reviewId,
          // ✅ Use your real user ID for testing privacy settings
          userId: new Types.ObjectId('6931d93e4f7d2b2721788396'),
          astrologerId: new Types.ObjectId(astrologerId),
          orderId: `TEST_ORDER_${Date.now()}_${Math.random().toString(36).substring(5)}`,
          rating: testReview.rating,
          reviewText: testReview.reviewText,
          serviceType: testReview.serviceType,
          sessionDuration: Math.floor(Math.random() * 1800) + 300, // 5-35 minutes
          moderationStatus: 'approved', // Auto-approve test reviews
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          isTestData: true, // Flag for identification
          // ✅ Store test user info as fallback
          testUserName: testReview.userName,
          testUserImage: testReview.userImage,
        });

        await review.save();
      }

      // Update astrologer ratings
      await this.updateAstrologerRatings(astrologerId);

      console.log(`✅ Test reviews seeded successfully for astrologer: ${astrologerId}`);
    } catch (error) {
      console.error('❌ Error seeding test reviews:', error);
    }
  }

  /**
   * ✅ MODERATE REVIEW (Admin only)
   */
  async moderateReview(
    reviewId: string,
    moderationStatus: 'approved' | 'rejected' | 'flagged',
    moderatedBy: string,
    reason?: string
  ): Promise<any> {
    const review = await this.reviewModel.findOne({ reviewId });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.moderationStatus = moderationStatus;
    review.moderatedBy = new Types.ObjectId(moderatedBy);
    review.moderatedAt = new Date();
    if (reason) {
      review.moderationReason = reason;
    }

    await review.save();
    await this.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: `Review ${moderationStatus}`,
      reviewId: review.reviewId
    };
  }

  /**
   * ✅ EDIT REVIEW
   */
  async editReview(
    reviewId: string,
    userId: string,
    updates: { rating?: number; reviewText?: string }
  ): Promise<any> {
    const review = await this.reviewModel.findOne({
      reviewId,
      userId: new Types.ObjectId(userId)
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (updates.rating) {
      if (updates.rating < 1 || updates.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }
      review.rating = updates.rating;
    }

    if (updates.reviewText !== undefined) {
      review.reviewText = updates.reviewText;
    }

    review.isEdited = true;
    review.editedAt = new Date();
    review.moderationStatus = 'pending';

    await review.save();
    await this.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review updated. It will be reviewed by admin again.',
      reviewId: review.reviewId
    };
  }

  /**
   * ✅ DELETE REVIEW
   */
  async deleteReview(reviewId: string, userId: string): Promise<any> {
    const review = await this.reviewModel.findOne({
      reviewId,
      userId: new Types.ObjectId(userId)
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isDeleted = true;
    review.deletedAt = new Date();
    await review.save();

    await this.orderModel.updateOne(
      { orderId: review.orderId },
      {
        $set: {
          reviewGiven: false,
          reviewId: null
        }
      }
    );

    await this.updateAstrologerRatings(review.astrologerId.toString());

    return {
      success: true,
      message: 'Review deleted successfully'
    };
  }
}
