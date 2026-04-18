import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { CompetitionResult, CompetitionResultDocument } from '../../schemas/competition-result.schema';
import { SubscriptionPlanDocument } from '../../schemas/subscription-plan.schema';
import { DiscountsService, DiscountResult } from '../discounts/discounts.service';

/**
 * CANONICAL INVOICE SERVICE
 * 
 * Single source of truth for invoice creation, status, and discount application.
 * 
 * Flow:
 * Plan → Subscription → createForSubscription() → DiscountEngine → Invoice
 */

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(CompetitionResult.name)
    private readonly competitionResultModel: Model<CompetitionResultDocument>,
    @Inject(forwardRef(() => DiscountsService))
    private readonly discountsService: DiscountsService,
  ) {}

  /**
   * CANONICAL: Create invoice for subscription WITH discount engine
   * 
   * Steps:
   * 1. Get plan basePrice / finalPrice as starting point
   * 2. Build discount context (childrenCount, monthsActive, medals, etc.)
   * 3. Call DiscountEngine.calculateDiscounts()
   * 4. Write invoice with base/discount/final amounts
   * 5. Record AppliedDiscount audit
   */
  async createForSubscription(
    subscription: SubscriptionDocument,
    plan?: SubscriptionPlanDocument,
    options?: { promoCode?: string },
  ) {
    const basePrice = plan?.basePrice ?? (subscription as any).price ?? 2000;
    const planDiscount = plan ? (plan.basePrice - plan.finalPrice) : 0;

    // Prevent duplicate: check if there's already a PENDING invoice for this subscription period
    const existingPending = await this.invoiceModel.findOne({
      subscriptionId: subscription._id.toString(),
      status: { $in: ['PENDING', 'OVERDUE'] },
    });
    if (existingPending) {
      this.logger.warn(`Skipping duplicate invoice for subscription ${subscription._id}`);
      return existingPending;
    }

    // === BUILD DISCOUNT CONTEXT ===
    const parentId = subscription.parentId;
    let dynamicDiscountAmount = 0;
    let appliedRules: DiscountResult['appliedRules'] = [];

    try {
      const discountResult = await this.discountsService.calculateDiscounts(
        parentId,
        {
          baseAmount: basePrice,
          childId: subscription.childId,
          context: 'SUBSCRIPTION',
          promoCode: options?.promoCode,
        },
      );

      dynamicDiscountAmount = discountResult.discountAmount;
      appliedRules = discountResult.appliedRules;

      this.logger.log(
        `Discount calc for sub ${subscription._id}: base=${basePrice}, ` +
        `planDiscount=${planDiscount}, dynamicDiscount=${dynamicDiscountAmount}, ` +
        `rules=${appliedRules.map(r => r.name).join(', ') || 'none'}`,
      );
    } catch (err) {
      // If discount engine fails, fall back to plan price (no crash)
      this.logger.warn(`DiscountEngine failed for sub ${subscription._id}: ${err}. Using plan price.`);
    }

    // === CALCULATE FINAL PRICE ===
    // Take the LARGER discount: plan-level OR dynamic engine
    const effectiveDiscount = Math.max(planDiscount, dynamicDiscountAmount);
    const finalPrice = Math.max(0, basePrice - effectiveDiscount);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3 days to pay

    const invoice = await this.invoiceModel.create({
      childId: subscription.childId,
      parentId: subscription.parentId,
      subscriptionId: subscription._id.toString(),
      amount: basePrice,
      discountAmount: effectiveDiscount,
      finalAmount: finalPrice,
      currency: 'UAH',
      description: `Оплата за ${plan?.name || (subscription as any).planName || 'абонемент'}`,
      dueDate,
      status: 'PENDING',
    });

    // === RECORD APPLIED DISCOUNT AUDIT ===
    if (appliedRules.length > 0 && dynamicDiscountAmount >= planDiscount) {
      try {
        const discountResult: DiscountResult = {
          baseAmount: basePrice,
          totalDiscountPercent: 0,
          totalDiscountFixed: 0,
          discountAmount: dynamicDiscountAmount,
          finalAmount: finalPrice,
          appliedRules,
        };
        await this.discountsService.recordAppliedDiscount(
          parentId,
          discountResult,
          'INVOICE',
          invoice._id.toString(),
        );
      } catch (err) {
        this.logger.warn(`Failed to record applied discount: ${err}`);
      }
    }

    this.logger.log(`Created invoice ${invoice._id}: base=${basePrice}, discount=${effectiveDiscount}, final=${finalPrice}`);
    return invoice;
  }

  /**
   * CANONICAL: Mark invoice as paid
   * This is the SINGLE place where invoice → PAID transition happens.
   * All post-payment hooks should be called from the caller (PaymentService).
   */
  async markAsPaid(invoiceId: string, paymentDetails?: Record<string, any>) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return null;

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    
    if (paymentDetails) {
      invoice.wayforpayTransactionId = paymentDetails.transactionId;
      invoice.wayforpayCardPan = paymentDetails.cardPan;
      invoice.wayforpayPaymentSystem = paymentDetails.paymentSystem;
    }

    await invoice.save();
    return invoice;
  }

  /**
   * Mark invoice as overdue
   */
  async markOverdue(invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return null;
    if (invoice.status === 'PENDING') {
      invoice.status = 'OVERDUE';
      await invoice.save();
    }
    return invoice;
  }

  /**
   * Admin confirms manual payment
   */
  async confirmPayment(invoiceId: string, adminNote?: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return null;
    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    if (adminNote) invoice.adminNote = adminNote;
    await invoice.save();
    return invoice;
  }

  async getPendingInvoices() {
    return this.invoiceModel.find({ status: 'PENDING' });
  }

  async getOverdueInvoices() {
    return this.invoiceModel.find({ status: 'OVERDUE' });
  }

  async getById(invoiceId: string) {
    return this.invoiceModel.findById(invoiceId);
  }

  async listInvoices(filters?: { status?: string; parentId?: string; childId?: string }) {
    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.parentId) query.parentId = filters.parentId;
    if (filters?.childId) query.childId = filters.childId;
    return this.invoiceModel.find(query).sort({ createdAt: -1 }).limit(100);
  }

  /**
   * Check if a PENDING/OVERDUE invoice already exists for this subscription
   * Used to prevent duplicate renewal invoices
   */
  async hasPendingInvoice(subscriptionId: string): Promise<boolean> {
    const existing = await this.invoiceModel.findOne({
      subscriptionId,
      status: { $in: ['PENDING', 'OVERDUE'] },
    });
    return !!existing;
  }
}
