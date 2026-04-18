import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ParentInsightsService, ChildInsight } from './parent-insights.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentInsightsController {
  constructor(
    private readonly insightsService: ParentInsightsService,
  ) {}

  @Get('insights')
  async getInsights(@Request() req): Promise<{ children: ChildInsight[] }> {
    // JWT strategy returns user.id (not user.sub)
    return this.insightsService.getInsights(req.user.id);
  }

  @Get('finance/overview')
  async getFinanceOverview(@Request() req) {
    return this.insightsService.getFinanceOverview(req.user.id);
  }

  @Get('invoices')
  async getInvoices(@Request() req) {
    return this.insightsService.getParentInvoices(req.user.id);
  }
}
