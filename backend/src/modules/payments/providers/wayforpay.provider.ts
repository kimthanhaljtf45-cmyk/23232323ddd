import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentSessionResult,
  PaymentCallbackResult,
} from './payment-provider.interface';
import { InvoiceDocument } from '../../../schemas/invoice.schema';

/**
 * WAYFORPAY PAYMENT PROVIDER
 * 
 * Ukrainian payment gateway integration.
 * https://wiki.wayforpay.com/
 */

export interface WayForPayConfig {
  merchantAccount: string;
  merchantSecretKey: string;
  merchantDomainName: string;
  returnUrl: string;
  serviceUrl: string;
  mode?: 'TEST' | 'LIVE';
}

export class WayForPayProvider implements PaymentProvider {
  constructor(private readonly config: WayForPayConfig) {}

  async createPaymentSession(
    invoice: InvoiceDocument,
  ): Promise<PaymentSessionResult> {
    const orderReference = `invoice_${invoice._id}_${Date.now()}`;
    const orderDate = Math.floor(Date.now() / 1000);
    const amount = ((invoice as any).finalAmount || invoice.amount).toFixed(2);

    const products = ['Subscription Payment'];
    const counts = [1];
    const prices = [amount];

    // Build signature according to WayForPay docs
    const signatureSource = [
      this.config.merchantAccount,
      this.config.merchantDomainName,
      orderReference,
      orderDate,
      amount,
      'UAH',
      ...products,
      ...counts,
      ...prices,
    ].join(';');

    const merchantSignature = crypto
      .createHmac('md5', this.config.merchantSecretKey)
      .update(signatureSource)
      .digest('hex');

    return {
      checkoutUrl: 'https://secure.wayforpay.com/pay',
      transactionReference: orderReference,
      formData: {
        merchantAccount: this.config.merchantAccount,
        merchantDomainName: this.config.merchantDomainName,
        orderReference,
        orderDate,
        amount,
        currency: 'UAH',
        productName: products,
        productCount: counts,
        productPrice: prices,
        merchantSignature,
        returnUrl: this.config.returnUrl,
        serviceUrl: this.config.serviceUrl,
        clientFirstName: 'Parent',
        language: 'UA',
      },
    };
  }

  async parseAndValidateCallback(
    payload: Record<string, any>,
  ): Promise<PaymentCallbackResult> {
    const {
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
      merchantSignature,
    } = payload;

    // Validate signature
    const signatureSource = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(';');

    const expectedSignature = crypto
      .createHmac('md5', this.config.merchantSecretKey)
      .update(signatureSource)
      .digest('hex');

    if (merchantSignature !== expectedSignature) {
      console.error('[WayForPay] Invalid callback signature');
      throw new BadRequestException('Invalid WayForPay callback signature');
    }

    // Extract invoice ID from orderReference
    const match = String(orderReference).match(/^invoice_([a-f0-9]{24})_/i);
    if (!match) {
      throw new BadRequestException('Invalid order reference format');
    }

    const invoiceId = match[1];

    return {
      success: transactionStatus === 'Approved',
      externalReference: orderReference,
      invoiceId,
      amount: Number(amount),
      rawPayload: payload,
      status:
        transactionStatus === 'Approved'
          ? 'SUCCESS'
          : transactionStatus === 'Pending'
          ? 'PENDING'
          : 'FAILED',
    };
  }
}
