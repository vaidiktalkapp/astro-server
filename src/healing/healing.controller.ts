import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HealingService } from './healing.service';
import { AdminAuthGuard } from '../admin/core/guards/admin-auth.guard';


@Controller('healing')
export class HealingController {
  constructor(private readonly healingService: HealingService) {}

  // --- Public Endpoints ---

  @Get('items')
  async getItems(@Query('type') type: string) {
    const data = await this.healingService.findAll(type);
    return { success: true, data };
  }

  @Get('item/:slug')
  async getItemBySlug(@Param('slug') slug: string) {
    const data = await this.healingService.findBySlug(slug);
    return { success: true, data };
  }

  // --- Admin Endpoints ---

  @UseGuards(AdminAuthGuard)
  @Get('admin/items')
  async adminGetItems(@Query('type') type: string) {
    const data = await this.healingService.adminFindAll(type);
    return { success: true, data };
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/items')
  async upsertItem(@Body() body: any) {
    const data = await this.healingService.upsert(body);
    return { success: true, data };
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/items/:id')
  async deleteItem(@Param('id') id: string) {
    await this.healingService.delete(id);
    return { success: true };
  }
}
