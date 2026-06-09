import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { MatrimonyChatService } from '../services/matrimony-chat.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../../admin/core/guards/admin-auth.guard';

@Controller('matrimony-chat')
export class MatrimonyChatController {
  constructor(private matrimonyChatService: MatrimonyChatService) {}

  // ===== USER ENDPOINTS =====

  @Get('history/:interestId')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Req() req: any,
    @Param('interestId') interestId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50'
  ): Promise<any> {
    const data = await this.matrimonyChatService.getChatHistory(
      req.user.userId,
      interestId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    return { success: true, data };
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSettings() {
    const settings = await this.matrimonyChatService.getChatSettings();
    return { success: true, data: settings };
  }

  @Get('active-order/:interestId')
  @UseGuards(JwtAuthGuard)
  async getActiveOrder(@Req() req: any, @Param('interestId') interestId: string) {
    const order = await this.matrimonyChatService.getActiveOrder(req.user.userId, interestId);
    return { success: true, data: order };
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseChatTime(
    @Req() req: any,
    @Body() body: { interestId: string; tierIndex: number }
  ) {
    const result = await this.matrimonyChatService.purchaseChatTime(
      req.user.userId,
      body.interestId,
      body.tierIndex
    );
    return { success: true, data: result };
  }

  // ===== ADMIN ENDPOINTS =====

  @Get('admin/conversations')
  @UseGuards(AdminAuthGuard)
  async getConversations(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    const data = await this.matrimonyChatService.getAllConversationsForAdmin(
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    return { success: true, data };
  }

  @Get('admin/messages/:interestId')
  @UseGuards(AdminAuthGuard)
  async getMessages(@Param('interestId') interestId: string) {
    const data = await this.matrimonyChatService.getChatMessagesForAdmin(interestId);
    return { success: true, data };
  }

  @Get('admin/settings')
  @UseGuards(AdminAuthGuard)
  async getAdminSettings() {
    const settings = await this.matrimonyChatService.getChatSettings();
    return { success: true, data: settings };
  }

  @Put('admin/settings')
  @UseGuards(AdminAuthGuard)
  async updateSettings(@Body() body: { isEnabled?: boolean; pricingTiers?: any[] }) {
    const settings = await this.matrimonyChatService.updateChatSettings(body);
    return { success: true, data: settings };
  }

  @Get('admin/orders')
  @UseGuards(AdminAuthGuard)
  async getOrders(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    const data = await this.matrimonyChatService.getChatOrdersForAdmin(
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    return { success: true, data };
  }
}
