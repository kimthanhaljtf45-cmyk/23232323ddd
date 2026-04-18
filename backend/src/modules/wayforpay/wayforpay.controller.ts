import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WayForPayService, WayForPayPaymentRequest, WayForPayCallback } from './wayforpay.service';

class CreatePaymentDto {
  invoiceId: string;
  returnUrl?: string;
  clientEmail?: string;
  clientPhone?: string;
}

class SimulatePaymentDto {
  invoiceId: string;
  success?: boolean;
}

@Controller('wayforpay')
export class WayForPayController {
  constructor(private readonly wayforpayService: WayForPayService) {}

  /**
   * Get payment form data for WayForPay widget
   */
  @Post('create-payment')
  @UseGuards(JwtAuthGuard)
  async createPayment(@Request() req, @Body() dto: CreatePaymentDto) {
    const appUrl = process.env.APP_URL || 'https://ataka.com.ua';
    
    const request: WayForPayPaymentRequest = {
      invoiceId: dto.invoiceId,
      returnUrl: dto.returnUrl || `${appUrl}/billing/success`,
      serviceUrl: `${appUrl}/api/wayforpay/callback`,
      clientEmail: dto.clientEmail,
      clientPhone: dto.clientPhone,
    };

    const widgetData = await this.wayforpayService.getWidgetData(request);
    return widgetData;
  }

  /**
   * Get redirect URL for WayForPay payment page
   */
  @Post('payment-url')
  @UseGuards(JwtAuthGuard)
  async getPaymentUrl(@Request() req, @Body() dto: CreatePaymentDto) {
    const appUrl = process.env.APP_URL || 'https://ataka.com.ua';
    
    const request: WayForPayPaymentRequest = {
      invoiceId: dto.invoiceId,
      returnUrl: dto.returnUrl || `${appUrl}/billing/success`,
      serviceUrl: `${appUrl}/api/wayforpay/callback`,
      clientEmail: dto.clientEmail,
      clientPhone: dto.clientPhone,
    };

    const paymentUrl = await this.wayforpayService.getPaymentUrl(request);
    return { paymentUrl };
  }

  /**
   * WayForPay callback (webhook) - receives payment status
   * This endpoint should NOT require authentication
   */
  @Post('callback')
  async handleCallback(@Body() callback: WayForPayCallback, @Res() res: Response) {
    try {
      const response = await this.wayforpayService.processCallback(callback);
      
      // WayForPay expects specific JSON response format
      return res.status(HttpStatus.OK).json({
        orderReference: callback.orderReference,
        status: response.status,
        time: response.time,
        signature: response.signature,
      });
    } catch (error) {
      // Even on error, respond to prevent WayForPay from retrying
      return res.status(HttpStatus.OK).json({
        orderReference: callback.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000),
        signature: '',
      });
    }
  }

  /**
   * Get invoice with payment details
   */
  @Get('invoice/:invoiceId')
  @UseGuards(JwtAuthGuard)
  async getInvoice(@Param('invoiceId') invoiceId: string) {
    return this.wayforpayService.getInvoiceWithPaymentData(invoiceId);
  }

  /**
   * Check payment status
   */
  @Get('status/:orderReference')
  @UseGuards(JwtAuthGuard)
  async checkStatus(@Param('orderReference') orderReference: string) {
    return this.wayforpayService.checkPaymentStatus(orderReference);
  }

  /**
   * Get payment statistics (admin only)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      return { error: 'Admin only' };
    }
    return this.wayforpayService.getPaymentStats();
  }

  /**
   * Simulate payment (TEST MODE ONLY)
   */
  @Post('simulate')
  @UseGuards(JwtAuthGuard)
  async simulatePayment(@Request() req, @Body() dto: SimulatePaymentDto) {
    if (req.user.role !== 'ADMIN') {
      return { error: 'Admin only' };
    }
    return this.wayforpayService.simulatePayment(dto.invoiceId, dto.success !== false);
  }

  /**
   * Payment success page redirect handler
   */
  @Get('success')
  async paymentSuccess(@Query('orderReference') orderReference: string, @Res() res: Response) {
    // Check payment status and redirect to app
    const appUrl = process.env.APP_URL || 'https://ataka.com.ua';
    return res.redirect(`${appUrl}/billing?status=success&ref=${orderReference}`);
  }

  /**
   * Payment failure page redirect handler
   */
  @Get('failure')
  async paymentFailure(@Query('orderReference') orderReference: string, @Res() res: Response) {
    const appUrl = process.env.APP_URL || 'https://ataka.com.ua';
    return res.redirect(`${appUrl}/billing?status=failed&ref=${orderReference}`);
  }
}
