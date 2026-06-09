import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../core/guards/admin-auth.guard';
import { PermissionsGuard } from '../../../core/guards/permissions.guard';
import { RequireRoles } from '../../../core/decorators/roles.decorator';
import { AdminServicesRevenueService } from '../services/admin-services-revenue.service';

@Controller('admin/services-revenue')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireRoles('admin', 'superadmin')
export class AdminServicesRevenueController {
  constructor(private readonly service: AdminServicesRevenueService) {}

  @Get('quick-stats')
  async getQuickStats() {
    return this.service.getQuickStats();
  }

  @Get('analytics')
  async getAnalytics(@Query('timeRange') timeRange: string) {
    return this.service.getRevenueAnalytics(timeRange);
  }
}
