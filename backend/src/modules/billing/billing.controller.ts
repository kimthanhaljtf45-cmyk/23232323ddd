import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

class CreateSubscriptionDto {
  childId: string;
  planName?: string;
  price?: number;
  dueDay?: number;
}

class UploadProofDto {
  proofUrl: string;
}

class AdminNoteDto {
  adminNote?: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ============ SUBSCRIPTIONS ============

  @Post('subscriptions')
  async createSubscription(@Request() req, @Body() dto: CreateSubscriptionDto) {
    const user = req.user;
    return this.billingService.createSubscription(
      user.id,
      dto.childId,
      dto.planName || 'Місячний абонемент',
      dto.price || 2500,
      dto.dueDay || 1,
    );
  }

  @Get('subscriptions')
  async getSubscriptions(@Request() req) {
    return this.billingService.getSubscriptions(req.user.id, req.user.role);
  }

  @Get('subscriptions/:id')
  async getSubscription(@Param('id') id: string) {
    const sub = await this.billingService.getSubscription(id);
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    return sub;
  }

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() data: Partial<any>,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.billingService.updateSubscription(id, data);
  }

  // ============ INVOICES ============

  @Get('invoices')
  async getInvoices(@Request() req, @Query('status') status?: string) {
    return this.billingService.getInvoices(req.user.id, req.user.role, status);
  }

  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    const invoice = await this.billingService.getInvoice(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  @Post('invoices/:id/upload-proof')
  async uploadPaymentProof(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UploadProofDto,
  ) {
    await this.billingService.uploadPaymentProof(id, dto.proofUrl, req.user.id);
    return { success: true, message: 'Підтвердження завантажено' };
  }

  @Post('invoices/:id/approve')
  async approvePayment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AdminNoteDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    await this.billingService.approvePayment(id, dto.adminNote);
    return { success: true, message: 'Оплату підтверджено' };
  }

  @Post('invoices/:id/reject')
  async rejectPayment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AdminNoteDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    await this.billingService.rejectPayment(id, dto.adminNote);
    return { success: true, message: 'Оплату відхилено' };
  }

  // ============ ADMIN ============

  @Get('stats')
  async getBillingStats(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.billingService.getBillingStats();
  }

  @Get('pending-review')
  async getPendingReviewInvoices(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.billingService.getPendingReviewInvoices();
  }

  @Post('run-check')
  async runBillingCheck(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    const generated = await this.billingService.checkAndGenerateInvoices();
    await this.billingService.checkOverdueInvoices();
    return { success: true, invoicesGenerated: generated };
  }

  @Post('run-renewal')
  async runRenewalCheck(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    const processed = await this.billingService.runRenewalCheck();
    return { success: true, processed };
  }
}
