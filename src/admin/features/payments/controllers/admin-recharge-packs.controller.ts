import { Controller, Get, Post, Delete, Body, Param, UseGuards, Put } from '@nestjs/common';
import { WalletService } from '../../../../payments/services/wallet.service';
import { AdminAuthGuard } from '../../../core/guards/admin-auth.guard';
import { RequirePermissions } from '../../../core/decorators/permissions.decorator';
import { Permissions } from '../../../core/config/permissions.config';

@Controller('admin/payments/recharge-packs')
@UseGuards(AdminAuthGuard)
export class AdminRechargePacksController {

  constructor(private walletService: WalletService) {}

  @Get()
  async getAll() {
    const packs = await this.walletService.getAllRechargePacks();
    return { success: true, data: packs };
  }

  @Post()
  @RequirePermissions(Permissions.PAYMENTS_VIEW)
  async savePack(@Body() body: { amount: number; bonusPercentage: number; isPopular: boolean; isActive: boolean }) {
    const pack = await this.walletService.saveRechargePack(body);
    return { success: true, message: 'Recharge pack saved', data: pack };
  }

  @Delete(':amount')
  @RequirePermissions(Permissions.PAYMENTS_VIEW)
  async deletePack(@Param('amount') amount: string) {
    await this.walletService.deleteRechargePack(Number(amount));
    return { success: true, message: 'Recharge pack deleted' };
  }
}