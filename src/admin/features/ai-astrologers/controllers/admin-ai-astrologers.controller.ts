import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Res, Put } from '@nestjs/common';
import { AdminAiAstrologersService } from '../services/admin-ai-astrologers.service';
import { AdminAuthGuard } from '../../../core/guards/admin-auth.guard';
import { CreateAiAstrologerDto } from '../../../../ai-astrologers/dto/create-ai-astrologer.dto';
import { UpdateAiAstrologerDto } from '../../../../ai-astrologers/dto/update-ai-astrologer.dto';
import type { Response } from 'express';

@Controller('admin/ai-astrologers')
@UseGuards(AdminAuthGuard)
export class AdminAiAstrologersController {
    constructor(private readonly adminAiService: AdminAiAstrologersService) { }

    @Get()
    async findAll(@Query() query: any) {
        const result = await this.adminAiService.findAll(query);
        return { success: true, data: result };
    }

    @Get('stats')
    async getQuickStats() {
        const stats = await this.adminAiService.getQuickStats();
        return { success: true, data: stats };
    }

    @Get('performance-metrics')
    async getPerformanceMetrics() {
        const metrics = await this.adminAiService.getPerformanceMetrics();
        return { success: true, data: metrics };
    }

    @Get('overall-stats')
    async getOverallStats(@Query('timeRange') timeRange: string = 'monthly') {
        const stats = await this.adminAiService.getOverallStats(timeRange);
        return { success: true, data: stats };
    }

    @Get('chat-logs')
    async getChatLogs(@Query() query: any) {
        const logs = await this.adminAiService.getChatLogs(query);
        return { success: true, data: logs };
    }

    @Get('chat-logs/export')
    async exportChats(@Res() res: Response) {
        const csv = await this.adminAiService.exportChats();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ai_chat_logs.csv');
        return res.send(csv);
    }

    @Get('chat-logs/:id')
    async getChatLogDetails(@Param('id') id: string) {
        const log = await this.adminAiService.getChatLogDetails(id);
        return { success: true, data: log };
    }

    @Get('chat-logs/:id/messages')
    async getChatMessages(@Param('id') id: string) {
        const messages = await this.adminAiService.getChatMessages(id);
        return { success: true, data: messages };
    }

    @Get('call-logs')
    async getCallLogs(@Query() query: any) {
        const logs = await this.adminAiService.getCallLogs(query);
        return { success: true, data: logs };
    }

    @Get('call-logs/:id')
    async getCallLogDetails(@Param('id') id: string) {
        const log = await this.adminAiService.getCallLogDetails(id);
        return { success: true, data: log };
    }

    @Get('chat-stats')
    async getChatStats() {
        const stats = await this.adminAiService.getChatStatistics();
        return { success: true, data: stats };
    }

    @Get('transactions')
    async getTransactions(@Query() query: any) {
        const result = await this.adminAiService.getTransactions(query);
        return { success: true, data: result };
    }

    @Get('transactions/export')
    async exportBilling(@Res() res: Response) {
        const csv = await this.adminAiService.exportBilling();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ai_billing.csv');
        return res.send(csv);
    }

    @Get('wallet-stats')
    async getWalletStats() {
        const stats = await this.adminAiService.getWalletStats();
        return { success: true, data: stats };
    }

    @Get('analytics/revenue')
    async getAIRevenueAnalytics(
        @Query('timeRange') timeRange: string = 'monthly',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.adminAiService.getAIRevenueAnalytics(timeRange, startDate, endDate);
    }

    @Get('analytics/time-slots')
    async getAITimeSlotAnalysis() {
        return this.adminAiService.getAITimeSlotAnalysis();
    }

    @Get('analytics/comparison')
    async getAIAstrologerComparison(
        @Query('metric') metric: string = 'revenue',
        @Query('limit') limit: string = '10',
    ) {
        return this.adminAiService.getAIAstrologerComparison(metric, parseInt(limit, 10));
    }

    @Get('export')
    async exportProfiles(@Res() res: Response) {
        const csv = await this.adminAiService.exportProfiles();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ai_astrologers.csv');
        return res.send(csv);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const result = await this.adminAiService.findOne(id);
        return { success: true, data: result };
    }

    @Post()
    async create(@Body() createDto: CreateAiAstrologerDto) {
        const result = await this.adminAiService.create(createDto);
        return { success: true, message: 'AI Astrologer created successfully', data: result };
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateDto: UpdateAiAstrologerDto) {
        const result = await this.adminAiService.update(id, updateDto);
        return { success: true, message: 'AI Astrologer updated successfully', data: result };
    }

    @Patch(':id/toggle-availability')
    async toggleAvailability(@Param('id') id: string) {
        const result = await this.adminAiService.toggleAvailability(id);
        return { success: true, message: 'Availability updated', data: result };
    }

    @Patch(':id/status')
    async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
        const result = await this.adminAiService.updateStatus(id, body.status);
        return { success: true, message: 'Status updated', data: result };
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.adminAiService.delete(id);
        return { success: true, message: 'AI Astrologer deleted successfully' };
    }

    @Patch('chat-logs/:id/audit')
    async auditChatLog(@Param('id') id: string, @Body() body: { status: string, notes?: string }) {
        const result = await this.adminAiService.updateChatAuditStatus(id, body.status, body.notes);
        return { success: true, message: `Chat session marked as ${body.status}`, data: result };
    }

    @Patch('call-logs/:id/audit')
    async auditCallLog(@Param('id') id: string, @Body() body: { status: string, notes?: string }) {
        const result = await this.adminAiService.updateCallAuditStatus(id, body.status, body.notes);
        return { success: true, message: `Call session marked as ${body.status}`, data: result };
    }
}
