import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * SUBSCRIPTION ENGINE CONTROLLER
 * 
 * Admin-only endpoints for managing:
 * - Plans (тарифи)
 * - Subscriptions (підписки)
 * - Invoices (рахунки)
 * - Revenue stats
 */

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // ==================== PLANS ====================

  @Get('plans')
  async getPlans(@Query('programType') programType?: string) {
    return this.service.getPlans(programType);
  }

  @Post('plans')
  async createPlan(@Body() body: {
    name: string;
    type: 'MONTH' | 'HALF_YEAR' | 'YEAR';
    durationMonths: number;
    basePrice: number;
    discountPercent: number;
    freezeDaysAllowed: number;
    programType?: string;
  }) {
    return this.service.createPlan(body);
  }

  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      basePrice: number;
      discountPercent: number;
      freezeDaysAllowed: number;
      isActive: boolean;
    }>,
  ) {
    return this.service.updatePlan(id, body);
  }

  // ==================== SUBSCRIPTIONS ====================

  @Get()
  async getSubscriptions(
    @Query('status') status?: string,
    @Query('childId') childId?: string,
    @Query('parentId') parentId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.service.getSubscriptions({ status, childId, parentId, groupId });
  }

  @Post()
  async createSubscription(@Body() body: {
    childId: string;
    parentId: string;
    planId: string;
    groupId?: string;
    groupName?: string;
    startDate?: Date;
  }) {
    return this.service.createSubscription(body);
  }

  @Put(':id/pause')
  async pauseSubscription(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.pauseSubscription(id, reason);
  }

  @Put(':id/resume')
  async resumeSubscription(@Param('id') id: string) {
    return this.service.resumeSubscription(id);
  }

  @Put(':id/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.cancelSubscription(id, reason);
  }

  @Put(':id/upgrade')
  async upgradeSubscription(
    @Param('id') id: string,
    @Body('newPlanId') newPlanId: string,
  ) {
    return this.service.upgradeSubscription(id, newPlanId);
  }

  // ==================== INVOICES ====================

  @Get('invoices')
  async getInvoices(
    @Query('status') status?: string,
    @Query('parentId') parentId?: string,
    @Query('childId') childId?: string,
  ) {
    return this.service.getInvoices({ status, parentId, childId });
  }

  @Post('invoices')
  async createInvoice(@Body() body: {
    childId: string;
    parentId: string;
    subscriptionId?: string;
    amount: number;
    description?: string;
    dueDate: Date;
    discountAmount?: number;
  }) {
    return this.service.createInvoice(body);
  }

  @Put('invoices/:id/confirm')
  async confirmPayment(
    @Param('id') id: string,
    @Body('adminNote') adminNote?: string,
  ) {
    return this.service.confirmPayment(id, adminNote);
  }

  @Put('invoices/:id/overdue')
  async markOverdue(@Param('id') id: string) {
    return this.service.markOverdue(id);
  }

  // ==================== REVENUE ====================

  @Get('revenue')
  async getRevenueStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getRevenueStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==================== RENEWAL CHECK ====================

  @Post('check-renewals')
  async checkRenewals() {
    return this.service.checkRenewals();
  }
}
