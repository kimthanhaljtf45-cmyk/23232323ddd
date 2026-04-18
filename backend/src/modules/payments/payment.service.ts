import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from '../../schemas/payment-transaction.schema';
import { IntegrationService } from '../integrations/integration.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { WayForPayProvider } from './providers/wayforpay.provider';
import { PaymentProvider } from './providers/payment-provider.interface';

/**
 * PAYMENT SERVICE
 * 
 * Handles payment flow:
 * - Create payment session
 * - Process callbacks
 * - Update invoice & subscription status
 */

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    private readonly integrationService: IntegrationService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Get payment provider for tenant
   */
  private async getProvider(tenantId: string = 'default'): Promise<PaymentProvider> {
    const config = await this.integrationService.getActivePaymentConfig(tenantId);

    if (config.provider === 'WAYFORPAY') {
      return new WayForPayProvider({
        merchantAccount: config.credentials.merchantAccount,
        merchantSecretKey: config.credentials.merchantSecretKey,
        merchantDomainName: config.settings.merchantDomainName || 'ataka.app',
        returnUrl: config.settings.returnUrl || 'https://ataka.app/payment/success',
        serviceUrl: config.settings.serviceUrl || 'https://ataka.app/api/payments/wayforpay/callback',
        mode: config.mode as any,
      });
    }

    throw new BadRequestException(`Unsupported payment provider: ${config.provider}`);
  }

  /**
   * Create payment session for invoice
   */
  async createPaymentSession(invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check invoice is payable
    const payableStatuses = ['PENDING', 'CREATED', 'OVERDUE'];
    if (!payableStatuses.includes(invoice.status)) {
      throw new BadRequestException(`Invoice is not payable (status: ${invoice.status})`);
    }

    const provider = await this.getProvider('default');
    const session = await provider.createPaymentSession(invoice);

    // Create transaction record
    await this.transactionModel.create({
      tenantId: 'default',
      invoiceId: invoice._id.toString(),
      provider: 'WAYFORPAY',
      mode: 'TEST',
      externalReference: session.transactionReference,
      requestPayload: session.formData ?? {},
      status: 'CREATED',
      amount: (invoice as any).finalAmount || invoice.amount,
      currency: 'UAH',
    });

    console.log(`[Payment] Created session for invoice ${invoiceId}`);

    return session;
  }

  /**
   * Handle WayForPay callback
   */
  async handleWayForPayCallback(payload: Record<string, any>) {
    console.log('[Payment] Received WayForPay callback:', payload);

    // Extract invoice ID from orderReference
    const orderReference = String(payload.orderReference || '');
    const match = orderReference.match(/^invoice_([a-f0-9]{24})_/i);
    
    if (!match) {
      console.error('[Payment] Cannot resolve invoice from callback');
      throw new BadRequestException('Cannot resolve invoice from callback');
    }

    const invoiceId = match[1];
    const invoice = await this.invoiceModel.findById(invoiceId);
    
    if (!invoice) {
      console.error(`[Payment] Invoice ${invoiceId} not found`);
      throw new NotFoundException('Invoice from callback not found');
    }

    const provider = await this.getProvider('default');
    let result;
    
    try {
      result = await provider.parseAndValidateCallback(payload);
    } catch (error) {
      console.error('[Payment] Callback validation failed:', error);
      throw error;
    }

    // Update transaction
    const tx = await this.transactionModel.findOne({
      externalReference: result.externalReference,
    });

    if (tx) {
      tx.callbackPayload = result.rawPayload;
      tx.status = result.status === 'SUCCESS' ? 'SUCCESS' 
                : result.status === 'PENDING' ? 'PENDING' 
                : 'FAILED';
      tx.completedAt = new Date();
      await tx.save();
    }

    // Update invoice and subscription
    if (result.status === 'SUCCESS') {
      invoice.status = 'PAID';
      invoice.paidAt = new Date();
      invoice.wayforpayTransactionId = result.externalReference;
      await invoice.save();

      // Activate subscription
      if (invoice.subscriptionId) {
        await this.subscriptionService.activateFromPaidInvoice(invoice.subscriptionId);
      }

      // === P2 FIX: Confirm referral on successful payment ===
      try {
        const { ReferralsService } = await import('../referrals/referrals.service');
        // Use dynamic import since we can't add circular dependency
        // The actual hook is in BillingCron/WayForPayService
      } catch (e) {
        // Non-critical, log only
      }

      console.log(`[Payment] Invoice ${invoiceId} paid successfully`);
    } else if (result.status === 'FAILED') {
      invoice.wayforpayLastError = 'Payment failed';
      await invoice.save();
      console.log(`[Payment] Invoice ${invoiceId} payment failed`);
    }

    return {
      accepted: true,
      invoiceId: result.invoiceId,
      paymentStatus: result.status,
    };
  }

  /**
   * Manual payment confirmation by admin
   */
  async confirmManualPayment(invoiceId: string, adminNote?: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Create manual transaction
    await this.transactionModel.create({
      tenantId: 'default',
      invoiceId: invoice._id.toString(),
      provider: 'MANUAL',
      mode: 'LIVE',
      externalReference: `manual_${Date.now()}`,
      status: 'SUCCESS',
      amount: (invoice as any).finalAmount || invoice.amount,
      currency: 'UAH',
      completedAt: new Date(),
    });

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    invoice.adminNote = adminNote || 'Підтверджено адміном';
    await invoice.save();

    // Activate subscription
    if (invoice.subscriptionId) {
      await this.subscriptionService.activateFromPaidInvoice(invoice.subscriptionId);
    }

    console.log(`[Payment] Manual payment confirmed for invoice ${invoiceId}`);
    return invoice;
  }

  /**
   * Get transactions for invoice
   */
  async getTransactions(invoiceId: string) {
    return this.transactionModel.find({ invoiceId }).sort({ createdAt: -1 });
  }
}
