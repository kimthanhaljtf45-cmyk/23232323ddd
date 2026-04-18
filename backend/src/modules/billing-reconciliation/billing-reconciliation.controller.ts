import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BillingReconciliationService } from './billing-reconciliation.service';

@Controller('admin/billing-reconciliation')
export class BillingReconciliationController {
  constructor(
    private readonly reconciliationService: BillingReconciliationService,
  ) {}

  @Get()
  async getReconciliation() {
    return this.reconciliationService.getLatestReconciliation();
  }

  @Post('run')
  async runReconciliation() {
    const issues = await this.reconciliationService.runManual();
    return {
      success: true,
      issuesFound: issues.length,
      critical: issues.filter(i => i.severity === 'CRITICAL').length,
      warning: issues.filter(i => i.severity === 'WARNING').length,
      issues,
    };
  }
}
