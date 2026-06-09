import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../schemas/ai-astrologers-profile.schema';
import { ChatSession, ChatSessionDocument } from '../../chat/schemas/chat-session.schema';

@Injectable()
export class AiAnalyticsService {
    private readonly logger = new Logger(AiAnalyticsService.name);

    constructor(
        @InjectModel(AiAstrologerProfile.name) private aiAstrologerModel: Model<AiAstrologerProfileDocument>,
        @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSessionDocument>,
    ) { }

    /**
     * Get revenue analytics for specified time range
     */
    async getRevenueAnalytics(timeRange: string, startDate?: string, endDate?: string) {
        try {
            const { start, end, groupByFormat } = this.getTimeRangeDates(timeRange, startDate, endDate);

            // Aggregate revenue by time period from chat sessions
            const revenueData = await this.chatSessionModel.aggregate([
                {
                    $match: {
                        astrologerModel: 'AiAstrologerProfile',
                        status: 'ended',
                        endTime: { $gte: start, $lte: end },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: groupByFormat, date: '$endTime', timezone: 'Asia/Kolkata' } },
                        totalRevenue: { $sum: '$totalAmount' },
                        totalSessions: { $sum: 1 },
                        avgDuration: { $avg: '$duration' },
                        totalMinutes: { $sum: '$billedMinutes' },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Fill in gaps for missing dates
            const filledData = this.fillDateGaps(revenueData, start, end, timeRange);

            // Calculate totals and trends
            const totals = {
                totalRevenue: revenueData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0),
                totalSessions: revenueData.reduce((sum, item) => sum + (item.totalSessions || 0), 0),
                avgSessionDuration: revenueData.reduce((sum, item) => sum + (item.avgDuration || 0), 0) / (revenueData.length || 1),
                totalMinutes: revenueData.reduce((sum, item) => sum + (item.totalMinutes || 0), 0),
            };

            return {
                success: true,
                data: {
                    chartData: filledData,
                    totals,
                    period: { start, end, timeRange },
                },
            };
        } catch (error) {
            this.logger.error(`Error getting revenue analytics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get time slot analysis - identify high-demand hours and days
     */
    async getTimeSlotAnalysis() {
        try {
            // Analyze sessions by hour of day and day of week
            const timeSlotData = await this.chatSessionModel.aggregate([
                {
                    $match: {
                        astrologerModel: 'AiAstrologerProfile',
                        status: { $in: ['active', 'ended'] },
                        startTime: { $exists: true },
                    },
                },
                {
                    $project: {
                        hour: { $hour: { date: '$startTime', timezone: 'Asia/Kolkata' } },
                        dayOfWeek: { $dayOfWeek: { date: '$startTime', timezone: 'Asia/Kolkata' } },
                        duration: 1,
                        totalAmount: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            hour: '$hour',
                            dayOfWeek: '$dayOfWeek',
                        },
                        sessionCount: { $sum: 1 },
                        avgDuration: { $avg: '$duration' },
                        totalRevenue: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } },
            ]);

            // Group by hour for peak hours chart
            const hourlyData = await this.chatSessionModel.aggregate([
                {
                    $match: {
                        astrologerModel: 'AiAstrologerProfile',
                        status: { $in: ['active', 'ended'] },
                        startTime: { $exists: true },
                    },
                },
                {
                    $project: {
                        hour: { $hour: { date: '$startTime', timezone: 'Asia/Kolkata' } },
                    },
                },
                {
                    $group: {
                        _id: '$hour',
                        sessions: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Format for heatmap (24 hours x 7 days)
            const heatmapData = this.formatHeatmapData(timeSlotData);

            // Format for peak hours chart (Ensure all 24 hours are represented)
            const peakHours: any[] = [];
            for (let h = 0; h < 24; h++) {
                const hourData = hourlyData.find(item => item._id === h);
                peakHours.push({
                    hour: h.toString(),
                    sessions: hourData?.sessions || 0,
                });
            }

            // Find top 5 peak time slots
            const topSlots = timeSlotData
                .sort((a, b) => b.sessionCount - a.sessionCount)
                .slice(0, 5)
                .map((slot) => ({
                    day: this.getDayName(slot._id.dayOfWeek),
                    hour: slot._id.hour,
                    sessionCount: slot.sessionCount,
                    avgDuration: Math.round(slot.avgDuration),
                    revenue: slot.totalRevenue,
                }));

            return {
                success: true,
                data: {
                    heatmap: heatmapData,
                    peakHours,
                    topSlots,
                },
            };
        } catch (error) {
            this.logger.error(`Error getting time slot analysis: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get astrologer comparison metrics
     */
    async getAstrologerComparison(metric: string = 'revenue', limit: number = 10) {
        try {
            // Get all AI astrologers with their stats
            const astrologers = await this.aiAstrologerModel.find({ isAvailable: true }).lean();

            // Get session stats for each astrologer
            const astrologerStats = await Promise.all(
                astrologers.map(async (astrologer) => {
                    const sessions = await this.chatSessionModel.find({
                        astrologerId: astrologer._id,
                        astrologerModel: 'AiAstrologerProfile',
                        status: { $in: ['active', 'ended'] },
                    });

                    const completedSessions = sessions.filter((s) => s.status === 'ended');
                    const totalSessions = sessions.length;
                    const conversionRate = totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;

                    // Calculate satisfaction from ratings
                    const ratedSessions = completedSessions.filter((s) => s.userSatisfactionRating);
                    const avgSatisfaction =
                        ratedSessions.length > 0
                            ? ratedSessions.reduce((sum, s) => sum + (s.userSatisfactionRating || 0), 0) / ratedSessions.length
                            : 0;

                    // Calculate total revenue
                    const totalRevenue = completedSessions.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                    // Calculate average session duration
                    const avgSessionDuration =
                        completedSessions.length > 0
                            ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length
                            : 0;

                    return {
                        id: astrologer._id.toString(),
                        name: astrologer.name,
                        image: astrologer.image,
                        personalityType: astrologer.personalityType,
                        totalSessions,
                        completedSessions: completedSessions.length,
                        totalRevenue,
                        avgSessionDuration,
                        conversionRate,
                        satisfactionScore: avgSatisfaction,
                        averageLatency: astrologer.averageLatency || 0,
                        averageAccuracy: astrologer.averageAccuracy || 0,
                        rating: astrologer.rating || 0,
                    };
                }),
            );

            // Sort by the specified metric
            const sortedAstrologers = this.sortByMetric(astrologerStats, metric).slice(0, limit);

            // Calculate platform averages
            const platformAvg = {
                conversionRate:
                    astrologerStats.reduce((sum, a) => sum + a.conversionRate, 0) / (astrologerStats.length || 1),
                satisfactionScore:
                    astrologerStats.reduce((sum, a) => sum + a.satisfactionScore, 0) / (astrologerStats.length || 1),
                avgSessionDuration:
                    astrologerStats.reduce((sum, a) => sum + a.avgSessionDuration, 0) / (astrologerStats.length || 1),
                totalRevenue: astrologerStats.reduce((sum, a) => sum + a.totalRevenue, 0),
            };

            return {
                success: true,
                data: {
                    astrologers: sortedAstrologers,
                    platformAverage: platformAvg,
                    totalAstrologers: astrologers.length,
                },
            };
        } catch (error) {
            this.logger.error(`Error getting astrologer comparison: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get conversion metrics and funnel data
     */
    async getConversionMetrics() {
        try {
            // Calculate conversion funnel
            const astrologers = await this.aiAstrologerModel.countDocuments();

            const sessions = await this.chatSessionModel.aggregate([
                {
                    $match: {
                        astrologerModel: 'AiAstrologerProfile',
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalInitiated: { $sum: 1 },
                        totalStarted: {
                            $sum: { $cond: [{ $in: ['$status', ['active', 'ended']] }, 1, 0] },
                        },
                        totalCompleted: {
                            $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] },
                        },
                        totalRated: {
                            $sum: { $cond: [{ $ne: ['$userSatisfactionRating', null] }, 1, 0] },
                        },
                    },
                },
            ]);

            const data = sessions[0] || {
                totalInitiated: 0,
                totalStarted: 0,
                totalCompleted: 0,
                totalRated: 0,
            };

            // Calculate conversion rates
            const initiatedToStarted = data.totalInitiated > 0 ? (data.totalStarted / data.totalInitiated) * 100 : 0;
            const startedToCompleted = data.totalStarted > 0 ? (data.totalCompleted / data.totalStarted) * 100 : 0;
            const completedToRated = data.totalCompleted > 0 ? (data.totalRated / data.totalCompleted) * 100 : 0;

            return {
                success: true,
                data: {
                    funnel: [
                        { stage: 'Available Astrologers', count: astrologers, percentage: 100 },
                        { stage: 'Sessions Initiated', count: data.totalInitiated, percentage: 100 },
                        { stage: 'Sessions Started', count: data.totalStarted, percentage: initiatedToStarted },
                        { stage: 'Sessions Completed', count: data.totalCompleted, percentage: startedToCompleted },
                        { stage: 'Sessions Rated', count: data.totalRated, percentage: completedToRated },
                    ],
                    conversionRates: {
                        initiatedToStarted,
                        startedToCompleted,
                        completedToRated,
                        overallConversion: data.totalInitiated > 0 ? (data.totalCompleted / data.totalInitiated) * 100 : 0,
                    },
                },
            };
        } catch (error) {
            this.logger.error(`Error getting conversion metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    // Helper methods

    private getTimeRangeDates(timeRange: string, startDate?: string, endDate?: string) {
        // Use Asia/Kolkata timezone for starting/ending dates
        const getISTNow = () => {
            const now = new Date();
            const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            return new Date(istString);
        };

        const istNow = getISTNow();
        let start: Date;
        let end: Date = new Date(istNow);
        let groupByFormat: string;

        if (timeRange === 'custom' && startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            groupByFormat = '%Y-%m-%d';
        } else {
            switch (timeRange) {
                case 'daily':
                    start = new Date(istNow);
                    start.setHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d %H:00';
                    break;
                case 'weekly':
                case 'last7days':
                    start = new Date(istNow);
                    start.setDate(istNow.getDate() - 7);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'last30days':
                    start = new Date(istNow);
                    start.setDate(istNow.getDate() - 30);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'monthly':
                    start = new Date(istNow);
                    start.setDate(1);
                    start.setHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m-%d';
                    break;
                case 'yearly':
                    start = new Date(istNow);
                    start.setMonth(0, 1);
                    start.setHours(0, 0, 0, 0);
                    groupByFormat = '%Y-%m';
                    break;
                default:
                    start = new Date(istNow);
                    start.setMonth(istNow.getMonth() - 1);
                    groupByFormat = '%Y-%m-%d';
            }
        }

        end.setHours(23, 59, 59, 999);

        // Convert back to UTC for MongoDB queries if necessary, 
        // but wait, MongoDB queries on Date objects are UTC.
        // We need to shift these back to UTC based on IST offset to get the right range.
        const istOffset = 5.5 * 60 * 60 * 1000;
        const startUtc = new Date(start.getTime() - istOffset);
        const endUtc = new Date(end.getTime() - istOffset);

        return { start: startUtc, end: endUtc, groupByFormat };
    }

    private fillDateGaps(data: any[], start: Date, end: Date, timeRange: string) {
        const filledData: any[] = [];
        const dataMap = new Map(data.map((item) => [item._id, item]));

        const current = new Date(start);

        while (current <= end) {
            const dateStr = this.formatDateForTimeRange(current, timeRange);
            const existing = dataMap.get(dateStr);

            filledData.push({
                date: dateStr,
                revenue: existing?.totalRevenue || 0,
                sessions: existing?.totalSessions || 0,
                avgDuration: existing?.avgDuration || 0,
                totalMinutes: existing?.totalMinutes || 0,
            });

            // Increment based on time range
            if (timeRange === 'daily') {
                current.setHours(current.getHours() + 1);
            } else if (timeRange === 'yearly') {
                current.setMonth(current.getMonth() + 1);
            } else {
                current.setDate(current.getDate() + 1);
            }
        }

        return filledData;
    }

    private formatDateForTimeRange(date: Date, timeRange: string): string {
        // Input date is UTC start of bucket, shift to IST for formatting
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffset);

        if (timeRange === 'daily') {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')} ${String(istDate.getHours()).padStart(2, '0')}:00`;
        } else if (timeRange === 'yearly') {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}`;
        } else {
            return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
        }
    }

    private formatHeatmapData(timeSlotData: any[]) {
        const heatmap: any[] = [];
        for (let day = 1; day <= 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const slot = timeSlotData.find((s) => s._id.dayOfWeek === day && s._id.hour === hour);
                heatmap.push({
                    day: this.getDayName(day),
                    hour,
                    sessionCount: slot?.sessionCount || 0,
                    avgDuration: slot?.avgDuration || 0,
                    revenue: slot?.totalRevenue || 0,
                });
            }
        }
        return heatmap;
    }

    private getDayName(dayOfWeek: number): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayOfWeek - 1] || 'Unknown';
    }

    private sortByMetric(astrologers: any[], metric: string) {
        switch (metric) {
            case 'revenue':
                return astrologers.sort((a, b) => b.totalRevenue - a.totalRevenue);
            case 'sessions':
                return astrologers.sort((a, b) => b.totalSessions - a.totalSessions);
            case 'conversion':
                return astrologers.sort((a, b) => b.conversionRate - a.conversionRate);
            case 'satisfaction':
                return astrologers.sort((a, b) => b.satisfactionScore - a.satisfactionScore);
            case 'duration':
                return astrologers.sort((a, b) => b.avgSessionDuration - a.avgSessionDuration);
            default:
                return astrologers.sort((a, b) => b.totalRevenue - a.totalRevenue);
        }
    }
}
