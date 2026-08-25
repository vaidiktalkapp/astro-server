import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ContactInquiriesService } from '../services/contact-inquiries.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admin Contact Inquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/contact-us')
export class AdminContactInquiriesController {
  constructor(private readonly service: ContactInquiriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contact inquiries' })
  async findAll(@Query('status') status?: string) {
    const inquiries = await this.service.findAll(status);
    return { success: true, data: inquiries };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update inquiry status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    const inquiry = await this.service.updateStatus(id, body.status, body.notes);
    return { success: true, message: 'Status updated', data: inquiry };
  }
}
