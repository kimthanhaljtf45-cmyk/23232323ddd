import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create payment session for invoice
   * Called when parent clicks "Pay"
   */
  @Post('invoice/:invoiceId/session')
  @UseGuards(JwtAuthGuard)
  async createPaymentSession(@Param('invoiceId') invoiceId: string) {
    return this.paymentService.createPaymentSession(invoiceId);
  }

  /**
   * WayForPay callback endpoint
   * Called by WayForPay after payment
   */
  @Post('wayforpay/callback')
  async handleWayForPayCallback(@Body() payload: Record<string, any>) {
    return this.paymentService.handleWayForPayCallback(payload);
  }

  /**
   * Manual payment confirmation by admin
   */
  @Post('invoice/:invoiceId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async confirmManualPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { adminNote?: string },
  ) {
    return this.paymentService.confirmManualPayment(invoiceId, body.adminNote);
  }

  /**
   * Get transactions for invoice
   */
  @Get('invoice/:invoiceId/transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Param('invoiceId') invoiceId: string) {
    return this.paymentService.getTransactions(invoiceId);
  }
}
