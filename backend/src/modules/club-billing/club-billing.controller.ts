import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ClubBillingService } from './club-billing.service';

@Controller('admin/clubs')
export class ClubBillingController {
  constructor(private readonly billingService: ClubBillingService) {}

  @Get(':clubId/billing')
  getBillingDashboard(@Param('clubId') clubId: string) {
    return this.billingService.getBillingDashboard(clubId);
  }

  @Post(':clubId/billing/subscribe')
  createSubscription(@Param('clubId') clubId: string, @Body() body: { plan: string }) {
    return this.billingService.createSubscription(clubId, body.plan);
  }

  @Patch(':clubId/billing/upgrade')
  upgradePlan(@Param('clubId') clubId: string, @Body() body: { plan: string }) {
    return this.billingService.upgradePlan(clubId, body.plan);
  }

  @Patch(':clubId/billing/cancel')
  cancelSubscription(@Param('clubId') clubId: string, @Body() body: { reason?: string }) {
    return this.billingService.cancelSubscription(clubId, body?.reason);
  }

  @Patch(':clubId/billing/invoices/:invoiceId/pay')
  markInvoicePaid(@Param('clubId') clubId: string, @Param('invoiceId') invoiceId: string) {
    return this.billingService.markInvoicePaid(invoiceId);
  }

  @Get(':clubId/billing/enforce/:resource')
  enforceLimits(@Param('clubId') clubId: string, @Param('resource') resource: 'students' | 'coaches' | 'branches') {
    return this.billingService.enforceLimits(clubId, resource);
  }

  @Post('billing/cron/generate')
  runBillingCron() {
    return this.billingService.billingCron();
  }

  @Post('billing/cron/overdue')
  runOverdueCron() {
    return this.billingService.overdueCron();
  }
}
