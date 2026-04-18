import { Injectable, Logger, BadRequestException, NotFoundException, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { AppliedDiscount, AppliedDiscountDocument } from '../../schemas/applied-discount.schema';
import { Referral, ReferralDocument } from '../../schemas/referral.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationService } from '../communication/communication.service';
import { ConfigService } from '@nestjs/config';

// WayForPay Test Credentials (from official documentation)
const WAYFORPAY_TEST_MERCHANT_ACCOUNT = 'test_merch_n1';
const WAYFORPAY_TEST_SECRET_KEY = 'flk3409refn54t54t*FNJRET';

export interface WayForPayPaymentRequest {
  invoiceId: string;
  returnUrl?: string;
  serviceUrl?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientFirstName?: string;
  clientLastName?: string;
}

export interface WayForPayCallback {
  merchantAccount: string;
  orderReference: string;
  merchantSignature: string;
  amount: number;
  currency: string;
  authCode?: string;
  email?: string;
  phone?: string;
  createdDate?: number;
  processingDate?: number;
  cardPan?: string;
  cardType?: string;
  issuerBankCountry?: string;
  issuerBankName?: string;
  recToken?: string;
  transactionStatus: string;
  reason?: string;
  reasonCode?: number;
  fee?: number;
  paymentSystem?: string;
}

export interface PaymentFormData {
  merchantAccount: string;
  merchantDomainName: string;
  merchantSignature: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
  returnUrl?: string;
  serviceUrl?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientFirstName?: string;
  clientLastName?: string;
  language: string;
}

@Injectable()
export class WayForPayService {
  private readonly logger = new Logger(WayForPayService.name);
  private readonly merchantAccount: string;
  private readonly merchantSecretKey: string;
  private readonly merchantDomainName: string;
  private readonly isTestMode: boolean;

  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(AppliedDiscount.name) private appliedDiscountModel: Model<AppliedDiscountDocument>,
    @InjectModel(Referral.name) private referralModel: Model<ReferralDocument>,
    private notificationsService: NotificationsService,
    private communicationService: CommunicationService,
    private configService: ConfigService,
  ) {
    // Use environment variables or fall back to test credentials
    this.merchantAccount = this.configService.get('WAYFORPAY_MERCHANT_ACCOUNT') || WAYFORPAY_TEST_MERCHANT_ACCOUNT;
    this.merchantSecretKey = this.configService.get('WAYFORPAY_SECRET_KEY') || WAYFORPAY_TEST_SECRET_KEY;
    this.merchantDomainName = this.configService.get('WAYFORPAY_DOMAIN') || 'ataka.com.ua';
    this.isTestMode = !this.configService.get('WAYFORPAY_MERCHANT_ACCOUNT');
    
    this.logger.log(`WayForPay initialized in ${this.isTestMode ? 'TEST' : 'PRODUCTION'} mode`);
  }

  /**
   * Generate HMAC_MD5 signature for WayForPay
   */
  private generateSignature(params: string[]): string {
    const signatureString = params.join(';');
    return crypto
      .createHmac('md5', this.merchantSecretKey)
      .update(signatureString, 'utf8')
      .digest('hex');
  }

  /**
   * Verify callback signature from WayForPay
   */
  private verifyCallbackSignature(callback: WayForPayCallback): boolean {
    const signatureParams = [
      callback.merchantAccount,
      callback.orderReference,
      String(callback.amount),
      callback.currency,
      callback.authCode || '',
      callback.cardPan || '',
      callback.transactionStatus,
      String(callback.reasonCode || ''),
    ];
    
    const expectedSignature = this.generateSignature(signatureParams);
    return callback.merchantSignature === expectedSignature;
  }

  /**
   * Create payment form data for invoice
   */
  async createPaymentForm(request: WayForPayPaymentRequest): Promise<PaymentFormData> {
    const invoice = await this.invoiceModel.findById(request.invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    // Get child info for product description
    const child = await this.childModel.findById(invoice.childId);
    const childName = child?.firstName || 'Учень';

    // Get parent info
    const parent = await this.userModel.findById(invoice.parentId);

    // Check for applied discounts
    const discount = await this.appliedDiscountModel.findOne({
      userId: invoice.parentId,
      context: 'INVOICE',
      status: 'PENDING',
    }).sort({ createdAt: -1 });

    // Calculate final amount
    let finalAmount = invoice.amount;
    let discountAmount = 0;
    
    if (discount) {
      discountAmount = discount.discountAmount;
      finalAmount = discount.finalAmount;
    }

    // Generate unique order reference
    const orderReference = `INV-${invoice._id}-${Date.now()}`;
    const orderDate = Math.floor(Date.now() / 1000);

    // Product details
    const productName = [invoice.description || `Оплата за тренування - ${childName}`];
    if (discountAmount > 0) {
      productName.push(`Знижка: -${discountAmount} UAH`);
    }
    const productCount = discountAmount > 0 ? [1, 1] : [1];
    const productPrice = discountAmount > 0 ? [invoice.amount, -discountAmount] : [invoice.amount];

    // Build signature params
    const signatureParams = [
      this.merchantAccount,
      this.merchantDomainName,
      orderReference,
      String(orderDate),
      String(finalAmount),
      invoice.currency || 'UAH',
      ...productName,
      ...productCount.map(String),
      ...productPrice.map(String),
    ];

    const merchantSignature = this.generateSignature(signatureParams);

    // Store payment attempt reference
    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      { 
        $set: { 
          wayforpayOrderReference: orderReference,
          wayforpayOrderDate: orderDate,
          finalAmount: finalAmount,
          discountAmount: discountAmount,
        } 
      }
    );

    const formData: PaymentFormData = {
      merchantAccount: this.merchantAccount,
      merchantDomainName: this.merchantDomainName,
      merchantSignature,
      orderReference,
      orderDate,
      amount: finalAmount,
      currency: invoice.currency || 'UAH',
      productName,
      productCount,
      productPrice,
      language: 'UA',
    };

    // Add optional fields
    if (request.returnUrl) formData.returnUrl = request.returnUrl;
    if (request.serviceUrl) formData.serviceUrl = request.serviceUrl;
    if (request.clientEmail || parent?.email) formData.clientEmail = request.clientEmail || parent?.email;
    if (request.clientPhone || parent?.phone) formData.clientPhone = request.clientPhone || parent?.phone;
    if (request.clientFirstName || parent?.firstName) formData.clientFirstName = request.clientFirstName || parent?.firstName;
    if (request.clientLastName || parent?.lastName) formData.clientLastName = request.clientLastName || parent?.lastName;

    this.logger.log(`Created payment form for invoice ${invoice._id}, amount: ${finalAmount} ${invoice.currency}`);
    
    return formData;
  }

  /**
   * Get WayForPay payment URL (redirect method)
   */
  async getPaymentUrl(request: WayForPayPaymentRequest): Promise<string> {
    const formData = await this.createPaymentForm(request);
    
    // Build URL with all parameters
    const params = new URLSearchParams();
    params.append('merchantAccount', formData.merchantAccount);
    params.append('merchantDomainName', formData.merchantDomainName);
    params.append('merchantSignature', formData.merchantSignature);
    params.append('orderReference', formData.orderReference);
    params.append('orderDate', String(formData.orderDate));
    params.append('amount', String(formData.amount));
    params.append('currency', formData.currency);
    params.append('language', formData.language);
    
    formData.productName.forEach((name, i) => {
      params.append(`productName[${i}]`, name);
    });
    formData.productCount.forEach((count, i) => {
      params.append(`productCount[${i}]`, String(count));
    });
    formData.productPrice.forEach((price, i) => {
      params.append(`productPrice[${i}]`, String(price));
    });
    
    if (formData.returnUrl) params.append('returnUrl', formData.returnUrl);
    if (formData.serviceUrl) params.append('serviceUrl', formData.serviceUrl);
    if (formData.clientEmail) params.append('clientEmail', formData.clientEmail);
    if (formData.clientPhone) params.append('clientPhone', formData.clientPhone);
    if (formData.clientFirstName) params.append('clientFirstName', formData.clientFirstName);
    if (formData.clientLastName) params.append('clientLastName', formData.clientLastName);
    
    return `https://secure.wayforpay.com/pay?${params.toString()}`;
  }

  /**
   * Get widget initialization data for WayForPay Widget
   */
  async getWidgetData(request: WayForPayPaymentRequest): Promise<PaymentFormData & { paymentUrl: string }> {
    const formData = await this.createPaymentForm(request);
    return {
      ...formData,
      paymentUrl: 'https://secure.wayforpay.com/pay',
    };
  }

  /**
   * Process WayForPay callback (webhook)
   */
  async processCallback(callback: WayForPayCallback): Promise<{ status: string; time: number; signature: string }> {
    this.logger.log(`Processing WayForPay callback for order ${callback.orderReference}, status: ${callback.transactionStatus}`);
    
    // Verify signature (skip for test mode to allow testing)
    if (!this.isTestMode) {
      const isValid = this.verifyCallbackSignature(callback);
      if (!isValid) {
        this.logger.error('Invalid callback signature');
        throw new BadRequestException('Invalid signature');
      }
    }

    // Extract invoice ID from order reference (format: INV-{invoiceId}-{timestamp})
    const orderRefParts = callback.orderReference.split('-');
    if (orderRefParts.length < 2 || orderRefParts[0] !== 'INV') {
      throw new BadRequestException('Invalid order reference format');
    }
    const invoiceId = orderRefParts[1];

    // Find invoice
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const now = Math.floor(Date.now() / 1000);

    // Process based on transaction status
    if (callback.transactionStatus === 'Approved') {
      // Payment successful
      await this.invoiceModel.updateOne(
        { _id: invoiceId },
        {
          status: 'PAID',
          paidAt: new Date(),
          wayforpayTransactionId: callback.authCode,
          wayforpayCardPan: callback.cardPan,
          wayforpayPaymentSystem: callback.paymentSystem,
          wayforpayFee: callback.fee,
        },
      );

      // Mark discount as used if any
      await this.appliedDiscountModel.updateOne(
        { userId: invoice.parentId, context: 'INVOICE', status: 'PENDING' },
        { status: 'USED', usedAt: new Date() },
      );

      // Notify parent
      await this.notificationsService.notifyUser(
        invoice.parentId,
        'PAYMENT_SUCCESS',
        'Оплату підтверджено! ✅',
        `Ваш платіж на ${callback.amount} ${callback.currency} успішно проведено`,
        { invoiceId, screen: '/billing' },
      );

      // Notify admins
      const admins = await this.userModel.find({ role: 'ADMIN' }).lean();
      for (const admin of admins) {
        await this.notificationsService.notifyUser(
          admin._id.toString(),
          'PAYMENT_RECEIVED',
          'Нова оплата отримана! 💰',
          `Отримано ${callback.amount} ${callback.currency} через WayForPay`,
          { invoiceId, screen: '/admin/billing' },
        );
      }

      this.logger.log(`Invoice ${invoiceId} marked as PAID`);

      // === PAYMENT UX: Send system message to parent ===
      try {
        await this.communicationService.sendSystemMessage({
          participants: [invoice.parentId],
          text: `Оплата отримана ✅ ${callback.amount} ${callback.currency}`,
          meta: { action: 'PAYMENT_SUCCESS', invoiceId },
        });
        this.logger.log(`System message sent to parent ${invoice.parentId}`);
      } catch (msgErr) {
        this.logger.warn(`System message failed (non-blocking): ${msgErr}`);
      }

      // === F3 FIX: Confirm referral lifecycle after successful payment ===
      try {
        const referral = await this.referralModel.findOne({
          invitedUserId: invoice.parentId,
          status: 'REGISTERED',
        });
        if (referral) {
          referral.status = 'CONFIRMED';
          referral.confirmedAt = new Date();
          await referral.save();

          // Process rewards inline (same logic as ReferralsService.processReferralRewards)
          const confirmedCount = await this.referralModel.countDocuments({
            inviterUserId: referral.inviterUserId,
            status: { $in: ['CONFIRMED', 'REWARDED'] },
          });
          referral.invitedRewardType = 'PERCENT_10';
          referral.invitedRewardGiven = true;
          referral.inviterRewardType = confirmedCount >= 2 ? 'FREE_MONTH' : 'PERCENT_50';
          referral.inviterRewardGiven = true;
          referral.status = 'REWARDED';
          referral.rewardedAt = new Date();
          await referral.save();

          this.logger.log(`Referral confirmed & rewarded for parent ${invoice.parentId}`);
        }
      } catch (refErr) {
        this.logger.warn(`Referral confirm failed (non-blocking): ${refErr}`);
      }

    } else if (callback.transactionStatus === 'Declined' || callback.transactionStatus === 'Expired') {
      // Payment failed
      await this.invoiceModel.updateOne(
        { _id: invoiceId },
        {
          wayforpayLastError: callback.reason,
          wayforpayLastErrorCode: callback.reasonCode,
        },
      );

      this.logger.log(`Payment declined for invoice ${invoiceId}: ${callback.reason}`);
    }

    // Generate response signature
    const responseParams = [callback.orderReference, 'accept', String(now)];
    const responseSignature = this.generateSignature(responseParams);

    return {
      status: 'accept',
      time: now,
      signature: responseSignature,
    };
  }

  /**
   * Check payment status via WayForPay API
   */
  async checkPaymentStatus(orderReference: string): Promise<any> {
    const signatureParams = [this.merchantAccount, orderReference];
    const signature = this.generateSignature(signatureParams);

    const response = await fetch('https://api.wayforpay.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionType: 'CHECK_STATUS',
        merchantAccount: this.merchantAccount,
        orderReference,
        merchantSignature: signature,
        apiVersion: 1,
      }),
    });

    return response.json();
  }

  /**
   * Get invoice with WayForPay data
   */
  async getInvoiceWithPaymentData(invoiceId: string): Promise<any> {
    const invoice = await this.invoiceModel.findById(invoiceId).lean();
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const child = await this.childModel.findById(invoice.childId).lean();
    const parent = await this.userModel.findById(invoice.parentId).lean();

    // Check for pending discounts
    const discount = await this.appliedDiscountModel.findOne({
      userId: invoice.parentId,
      context: 'INVOICE',
      status: 'PENDING',
    }).sort({ createdAt: -1 }).lean();

    return {
      ...invoice,
      child,
      parent: parent ? { firstName: parent.firstName, lastName: parent.lastName, email: parent.email, phone: parent.phone } : null,
      discount: discount ? {
        originalAmount: discount.originalAmount,
        discountAmount: discount.discountAmount,
        finalAmount: discount.finalAmount,
        ruleName: discount.ruleName,
      } : null,
      isTestMode: this.isTestMode,
    };
  }

  /**
   * Simulate payment for testing (TEST MODE ONLY)
   */
  async simulatePayment(invoiceId: string, success: boolean = true): Promise<any> {
    if (!this.isTestMode) {
      throw new BadRequestException('Simulation only available in test mode');
    }

    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Simulate callback
    const callback: WayForPayCallback = {
      merchantAccount: this.merchantAccount,
      orderReference: `INV-${invoiceId}-${Date.now()}`,
      merchantSignature: 'test_signature',
      amount: invoice.amount,
      currency: invoice.currency || 'UAH',
      authCode: success ? '123456' : undefined,
      cardPan: '4111****1111',
      transactionStatus: success ? 'Approved' : 'Declined',
      reason: success ? 'Ok' : 'Insufficient funds',
      reasonCode: success ? 1100 : 1002,
      paymentSystem: 'card',
      fee: 0,
    };

    return this.processCallback(callback);
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    todayRevenue: number;
    monthRevenue: number;
    transactionsCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [paidInvoices, pendingInvoices, overdueInvoices, todayPaid, monthPaid] = await Promise.all([
      this.invoiceModel.find({ status: 'PAID' }).lean(),
      this.invoiceModel.find({ status: 'PENDING' }).lean(),
      this.invoiceModel.find({ status: 'OVERDUE' }).lean(),
      this.invoiceModel.find({ status: 'PAID', paidAt: { $gte: today } }).lean(),
      this.invoiceModel.find({ status: 'PAID', paidAt: { $gte: monthStart } }).lean(),
    ]);

    return {
      totalPaid: paidInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalPending: pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalOverdue: overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      todayRevenue: todayPaid.reduce((sum, inv) => sum + inv.amount, 0),
      monthRevenue: monthPaid.reduce((sum, inv) => sum + inv.amount, 0),
      transactionsCount: paidInvoices.length,
    };
  }
}
