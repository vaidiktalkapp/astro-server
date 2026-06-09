import { Controller, Post, Body, Get, Param, Delete, Put, UseGuards, Query, Logger } from '@nestjs/common';
import { BabyNameService } from '../services/baby-name.service';
import { CreateBabyNameDto, UpdateBabyNameDto } from '../dto/baby-name.dto';
import { AdminAuthGuard } from '../../admin/core/guards/admin-auth.guard';

@Controller('admin/baby-names')
@UseGuards(AdminAuthGuard)

export class BabyNameAdminController {
  private readonly logger = new Logger(BabyNameAdminController.name);

  constructor(private readonly babyNameService: BabyNameService) {}

  // GET /api/v1/admin/baby-names?page=1&limit=50&gender=Boy&search=aarav
  @Get()
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('gender') gender?: string,
    @Query('search') search?: string,
    @Query('alphabet') alphabet?: string,
    @Query('nakshatra') nakshatra?: string,
    @Query('zodiacSign') zodiacSign?: string,
  ) {
    try {
      const result = await this.babyNameService.getAll(
        parseInt(page || '1'),
        parseInt(limit || '50'),
        gender,
        search,
        alphabet,
        nakshatra,
        zodiacSign,
      );
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // GET /api/v1/admin/baby-names/stats
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.babyNameService.getStats();
      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // POST /api/v1/admin/baby-names
  @Post()
  async create(@Body() dto: CreateBabyNameDto) {
    try {
      const result = await this.babyNameService.create(dto);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // POST /api/v1/admin/baby-names/bulk
  @Post('bulk')
  async bulkCreate(@Body() body: { names: CreateBabyNameDto[] }) {
    try {
      this.logger.log(`Bulk creating ${body.names?.length || 0} baby names`);
      const result = await this.babyNameService.bulkCreate(body.names);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // PUT /api/v1/admin/baby-names/:id
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBabyNameDto) {
    try {
      const result = await this.babyNameService.update(id, dto);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // POST /api/v1/admin/baby-names/backfill
  @Post('backfill')
  async backfill() {
    try {
      const result = await this.babyNameService.backfillDestinyNumbers();
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // DELETE /api/v1/admin/baby-names/:id
  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      const result = await this.babyNameService.delete(id);
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
