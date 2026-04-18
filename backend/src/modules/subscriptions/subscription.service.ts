import {
  Injectable,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../../schemas/subscription-plan.schema';
import { InvoiceService } from '../invoices/invoice.service';

/**
 * SUBSCRIPTION SERVICE
 * 
 * Manages subscription lifecycle:
 * - Create subscription (PENDING_PAYMENT)
 * - Activate from paid invoice
 * - Pause / Resume
 * - Cancel
 * - Renewal
 * - Expiration
 */

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Create new subscription (starts in PENDING_PAYMENT)
   */
  async createSubscription(dto: {
    childId: string;
    parentId: string;
    planId: string;
    groupId?: string;
    coachId?: string;
    autoRenew?: boolean;
  }) {
    const plan = await this.planModel.findById(dto.planId);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    
    // Add months based on plan duration
    let months = 1;
    if (plan.type === 'HALF_YEAR') months = 6;
    else if (plan.type === 'YEAR') months = 12;
    
    endDate.setMonth(endDate.getMonth() + months);

    const subscription = await this.subscriptionModel.create({
      childId: dto.childId,
      parentId: dto.parentId,
      planId: dto.planId,
      planName: plan.name,
      planType: plan.type,
      price: plan.basePrice,
      discountAmount: plan.basePrice - plan.finalPrice,
      finalPrice: plan.finalPrice,
      currency: 'UAH',
      startDate,
      endDate,
      status: 'PENDING_PAYMENT', // Awaiting first payment
      nextBillingDate: endDate,
      autoRenew: dto.autoRenew ?? false,
      groupId: dto.groupId,
      coachId: dto.coachId,
      freezeDaysAllowed: plan.freezeDaysAllowed || 14,
    });

    // Create invoice for this subscription
    await this.invoiceService.createForSubscription(subscription, plan);

    return subscription;
  }

  /**
   * Activate subscription from paid invoice
   */
  async activateFromPaidInvoice(subscriptionId: string) {
    const subscription = await this.subscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const plan = await this.planModel.findById(subscription.planId);

    // Only activate if in valid state
    const validStatuses = ['PENDING_PAYMENT', 'RENEWAL_SOON', 'EXPIRED'];
    if (!validStatuses.includes(subscription.status)) {
      console.log(`[Subscription] Cannot activate from status: ${subscription.status}`);
      return subscription;
    }

    const now = new Date();
    
    // Calculate new end date
    let months = 1;
    if (plan?.type === 'HALF_YEAR') months = 6;
    else if (plan?.type === 'YEAR') months = 12;

    const newEndDate = new Date(subscription.endDate || now);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    subscription.startDate = subscription.startDate || now;
    subscription.endDate = newEndDate;
    subscription.nextBillingDate = newEndDate;
    subscription.status = 'ACTIVE';
    subscription.lastBilledAt = now;

    await subscription.save();
    
    console.log(`[Subscription] Activated ${subscriptionId}, ends ${newEndDate}`);
    return subscription;
  }

  /**
   * Pause subscription (freeze)
   */
  async pauseSubscription(id: string, reason?: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    // Check freeze days limit
    const freezeDaysLeft = subscription.freezeDaysAllowed - subscription.freezeDaysUsed;
    if (freezeDaysLeft <= 0) {
      throw new BadRequestException('No freeze days remaining');
    }

    subscription.status = 'PAUSED';
    subscription.isFrozen = true;
    subscription.freezeStart = new Date();
    subscription.freezeReason = reason;

    await subscription.save();
    return subscription;
  }

  /**
   * Resume subscription (unfreeze)
   */
  async resumeSubscription(id: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== 'PAUSED') {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    const now = new Date();
    const freezeStart = subscription.freezeStart ?? now;
    
    // Calculate freeze days used
    const freezeDays = Math.ceil(
      (now.getTime() - freezeStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Extend end date by freeze days
    if (subscription.endDate) {
      subscription.endDate = new Date(
        subscription.endDate.getTime() + freezeDays * 24 * 60 * 60 * 1000
      );
      subscription.nextBillingDate = subscription.endDate;
    }

    subscription.freezeDaysUsed += freezeDays;
    subscription.isFrozen = false;
    subscription.freezeEnd = now;
    subscription.status = 'ACTIVE';

    await subscription.save();
    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: string, reason?: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = 'CANCELLED';
    subscription.cancelledReason = reason;
    subscription.cancelledAt = new Date();

    await subscription.save();
    return subscription;
  }

  /**
   * Mark as renewal soon (cron job)
   */
  async markAsRenewalSoon(id: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) return null;

    if (subscription.status === 'ACTIVE') {
      subscription.status = 'RENEWAL_SOON';
      await subscription.save();

      // Create renewal invoice
      const plan = await this.planModel.findById(subscription.planId);
      if (plan) {
        await this.invoiceService.createForSubscription(subscription, plan);
      }
    }

    return subscription;
  }

  /**
   * Mark as expired (cron job)
   */
  async expireSubscription(id: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) return null;

    subscription.status = 'EXPIRED';
    await subscription.save();

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getById(id: string) {
    return this.subscriptionModel.findById(id);
  }

  /**
   * List subscriptions
   */
  async listSubscriptions(filters?: { 
    status?: string; 
    parentId?: string; 
    childId?: string;
    coachId?: string;
    groupId?: string;
  }) {
    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.parentId) query.parentId = filters.parentId;
    if (filters?.childId) query.childId = filters.childId;
    if (filters?.coachId) query.coachId = filters.coachId;
    if (filters?.groupId) query.groupId = filters.groupId;

    return this.subscriptionModel.find(query).sort({ createdAt: -1 }).limit(200);
  }

  /**
   * Get subscriptions expiring soon (for cron)
   */
  async getExpiringSubscriptions(daysAhead: number = 5) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.subscriptionModel.find({
      status: 'ACTIVE',
      endDate: { $lte: futureDate, $gt: now },
    });
  }

  /**
   * Get expired subscriptions (for cron)
   */
  async getExpiredSubscriptions() {
    return this.subscriptionModel.find({
      status: { $in: ['ACTIVE', 'RENEWAL_SOON'] },
      endDate: { $lt: new Date() },
    });
  }
}
