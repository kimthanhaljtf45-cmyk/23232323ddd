import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Plan, PlanDocument } from '../../schemas/plan.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';

/**
 * SUBSCRIPTION ENGINE SERVICE
 * 
 * Core business logic for:
 * - Creating subscriptions
 * - Managing status (pause, resume, cancel)
 * - Freeze functionality
 * - Renewal logic
 * - Invoice generation
 */

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
  ) {}

  // ==================== PLANS ====================

  async getPlans(programType?: string) {
    const filter: any = { isActive: true };
    if (programType) {
      filter.$or = [{ programType }, { programType: null }];
    }
    
    const plans = await this.planModel.find(filter).sort({ sortOrder: 1 }).lean();
    return plans.map(p => ({
      id: p._id.toString(),
      name: p.name,
      type: p.type,
      durationMonths: p.durationMonths,
      basePrice: p.basePrice,
      discountPercent: p.discountPercent,
      finalPrice: p.finalPrice,
      freezeDaysAllowed: p.freezeDaysAllowed,
      personalSessionsIncluded: p.personalSessionsIncluded,
      competitionBenefits: p.competitionBenefits,
      isActive: p.isActive,
    }));
  }

  async createPlan(data: {
    name: string;
    type: 'MONTH' | 'HALF_YEAR' | 'YEAR';
    durationMonths: number;
    basePrice: number;
    discountPercent: number;
    freezeDaysAllowed: number;
    programType?: string;
  }) {
    const finalPrice = data.basePrice * (1 - data.discountPercent / 100);
    
    const plan = await this.planModel.create({
      ...data,
      finalPrice: Math.round(finalPrice),
      isActive: true,
    });

    return { id: plan._id.toString(), ...data, finalPrice: Math.round(finalPrice) };
  }

  async updatePlan(planId: string, updates: Partial<{
    name: string;
    basePrice: number;
    discountPercent: number;
    freezeDaysAllowed: number;
    isActive: boolean;
  }>) {
    const plan = await this.planModel.findById(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    if (updates.basePrice !== undefined || updates.discountPercent !== undefined) {
      const basePrice = updates.basePrice ?? plan.basePrice;
      const discount = updates.discountPercent ?? plan.discountPercent;
      updates['finalPrice'] = Math.round(basePrice * (1 - discount / 100));
    }

    await this.planModel.updateOne({ _id: planId }, { $set: updates });
    return { success: true };
  }

  // ==================== SUBSCRIPTIONS ====================

  async getSubscriptions(filters?: {
    status?: string;
    childId?: string;
    parentId?: string;
    groupId?: string;
  }) {
    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.childId) query.childId = filters.childId;
    if (filters?.parentId) query.parentId = filters.parentId;
    if (filters?.groupId) query.groupId = filters.groupId;

    const subs = await this.subscriptionModel.find(query).sort({ createdAt: -1 }).lean();
    
    // Enrich with child data
    const childIds = [...new Set(subs.map(s => s.childId))];
    const children = await this.childModel.find({ _id: { $in: childIds } }).lean();
    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    return subs.map(s => {
      const child = childMap.get(s.childId);
      return {
        id: s._id.toString(),
        childId: s.childId,
        studentName: child ? `${child.firstName} ${child.lastName}` : 'Unknown',
        parentId: s.parentId,
        planId: s.planId,
        planName: s.planName,
        planType: s.planType,
        price: s.price,
        finalPrice: s.finalPrice,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        groupName: s.groupName,
        isFrozen: s.isFrozen,
        freezeDaysUsed: s.freezeDaysUsed,
        freezeDaysAllowed: s.freezeDaysAllowed,
      };
    });
  }

  async createSubscription(data: {
    childId: string;
    parentId: string;
    planId: string;
    groupId?: string;
    groupName?: string;
    startDate?: Date;
  }) {
    const plan = await this.planModel.findById(data.planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const startDate = data.startDate || new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const subscription = await this.subscriptionModel.create({
      childId: data.childId,
      parentId: data.parentId,
      planId: data.planId,
      planName: plan.name,
      planType: plan.type,
      price: plan.finalPrice,
      discountAmount: 0,
      finalPrice: plan.finalPrice,
      startDate,
      endDate,
      status: 'ACTIVE',
      nextBillingDate: endDate,
      freezeDaysAllowed: plan.freezeDaysAllowed,
      groupId: data.groupId,
      groupName: data.groupName,
    });

    // Create initial invoice
    await this.createInvoice({
      childId: data.childId,
      parentId: data.parentId,
      subscriptionId: subscription._id.toString(),
      amount: plan.finalPrice,
      description: `Підписка: ${plan.name}`,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return {
      id: subscription._id.toString(),
      status: 'ACTIVE',
      planName: plan.name,
      startDate,
      endDate,
    };
  }

  async pauseSubscription(subscriptionId: string, reason?: string) {
    const sub = await this.subscriptionModel.findById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'ACTIVE') throw new BadRequestException('Can only pause active subscriptions');
    
    const remainingFreezeDays = sub.freezeDaysAllowed - sub.freezeDaysUsed;
    if (remainingFreezeDays <= 0) {
      throw new BadRequestException('No freeze days remaining');
    }

    await this.subscriptionModel.updateOne(
      { _id: subscriptionId },
      {
        $set: {
          status: 'PAUSED',
          isFrozen: true,
          freezeStart: new Date(),
          freezeReason: reason || 'По запиту клієнта',
        },
      }
    );

    return { success: true, message: 'Підписка заморожена' };
  }

  async resumeSubscription(subscriptionId: string) {
    const sub = await this.subscriptionModel.findById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'PAUSED') throw new BadRequestException('Subscription is not paused');

    // Calculate freeze days used
    const freezeDays = Math.ceil(
      (Date.now() - sub.freezeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Extend end date by freeze days
    const newEndDate = new Date(sub.endDate);
    newEndDate.setDate(newEndDate.getDate() + freezeDays);

    await this.subscriptionModel.updateOne(
      { _id: subscriptionId },
      {
        $set: {
          status: 'ACTIVE',
          isFrozen: false,
          freezeEnd: new Date(),
          endDate: newEndDate,
          nextBillingDate: newEndDate,
        },
        $inc: { freezeDaysUsed: freezeDays },
      }
    );

    return { success: true, message: 'Підписка відновлена', newEndDate };
  }

  async cancelSubscription(subscriptionId: string, reason?: string) {
    const sub = await this.subscriptionModel.findById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.subscriptionModel.updateOne(
      { _id: subscriptionId },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledReason: reason || 'Скасовано адміністратором',
        },
      }
    );

    return { success: true, message: 'Підписка скасована' };
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string) {
    const sub = await this.subscriptionModel.findById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    const newPlan = await this.planModel.findById(newPlanId);
    if (!newPlan) throw new NotFoundException('New plan not found');

    // Calculate price difference
    const remainingDays = Math.ceil(
      (sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const dailyRateCurrent = sub.finalPrice / (sub.planType === 'MONTH' ? 30 : sub.planType === 'HALF_YEAR' ? 180 : 365);
    const remainingValue = dailyRateCurrent * remainingDays;
    const priceDifference = newPlan.finalPrice - remainingValue;

    // Update subscription
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + newPlan.durationMonths);

    await this.subscriptionModel.updateOne(
      { _id: subscriptionId },
      {
        $set: {
          planId: newPlanId,
          planName: newPlan.name,
          planType: newPlan.type,
          price: newPlan.finalPrice,
          finalPrice: newPlan.finalPrice,
          endDate: newEndDate,
          nextBillingDate: newEndDate,
          freezeDaysAllowed: newPlan.freezeDaysAllowed,
        },
      }
    );

    // Create invoice for difference if positive
    if (priceDifference > 0) {
      await this.createInvoice({
        childId: sub.childId,
        parentId: sub.parentId,
        subscriptionId,
        amount: Math.round(priceDifference),
        description: `Доплата за перехід на ${newPlan.name}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    return { success: true, message: 'План оновлено', priceDifference: Math.round(priceDifference) };
  }

  // ==================== INVOICES ====================

  async getInvoices(filters?: { status?: string; parentId?: string; childId?: string }) {
    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.parentId) query.parentId = filters.parentId;
    if (filters?.childId) query.childId = filters.childId;

    const invoices = await this.invoiceModel.find(query).sort({ createdAt: -1 }).lean();

    // Enrich with child names
    const childIds = [...new Set(invoices.map(i => i.childId))];
    const children = await this.childModel.find({ _id: { $in: childIds } }).lean();
    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    return invoices.map(inv => {
      const child = childMap.get(inv.childId);
      return {
        id: inv._id.toString(),
        invoiceNumber: `INV-${inv._id.toString().slice(-8).toUpperCase()}`,
        childId: inv.childId,
        studentName: child ? `${child.firstName} ${child.lastName}` : 'Unknown',
        parentId: inv.parentId,
        subscriptionId: inv.subscriptionId,
        amount: inv.amount,
        discountAmount: inv.discountAmount || 0,
        finalAmount: inv.finalAmount || inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        description: inv.description,
        wayforpayOrderReference: inv.wayforpayOrderReference,
      };
    });
  }

  async createInvoice(data: {
    childId: string;
    parentId: string;
    subscriptionId?: string;
    amount: number;
    description?: string;
    dueDate: Date;
    discountAmount?: number;
  }) {
    // DEDUP GUARD: prevent duplicate invoices for same subscription + period
    if (data.subscriptionId) {
      const existing = await this.invoiceModel.findOne({
        subscriptionId: data.subscriptionId,
        status: { $in: ['PENDING', 'OVERDUE'] },
      });
      if (existing) {
        return {
          id: existing._id.toString(),
          invoiceNumber: `INV-${existing._id.toString().slice(-8).toUpperCase()}`,
          status: existing.status,
          duplicate: true,
        };
      }
    }

    const finalAmount = data.amount - (data.discountAmount || 0);
    
    const invoice = await this.invoiceModel.create({
      ...data,
      finalAmount,
      status: 'PENDING',
    });

    return {
      id: invoice._id.toString(),
      invoiceNumber: `INV-${invoice._id.toString().slice(-8).toUpperCase()}`,
      status: 'PENDING',
    };
  }

  async confirmPayment(invoiceId: string, adminNote?: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      {
        $set: {
          status: 'PAID',
          paidAt: new Date(),
          adminNote,
        },
      }
    );

    // If linked to subscription, ensure it's active
    if (invoice.subscriptionId) {
      await this.subscriptionModel.updateOne(
        { _id: invoice.subscriptionId, status: { $ne: 'CANCELLED' } },
        { $set: { status: 'ACTIVE' } }
      );
    }

    return { success: true, message: 'Оплата підтверджена' };
  }

  async markOverdue(invoiceId: string) {
    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      { $set: { status: 'OVERDUE' } }
    );
    return { success: true };
  }

  // ==================== REVENUE ====================

  async getRevenueStats(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();

    const paidInvoices = await this.invoiceModel.find({
      status: 'PAID',
      paidAt: { $gte: start, $lte: end },
    }).lean();

    const pendingInvoices = await this.invoiceModel.find({
      status: 'PENDING',
      dueDate: { $gte: start, $lte: end },
    }).lean();

    const overdueInvoices = await this.invoiceModel.find({
      status: 'OVERDUE',
    }).lean();

    const collected = paidInvoices.reduce((sum, i) => sum + (i.finalAmount || i.amount), 0);
    const expected = pendingInvoices.reduce((sum, i) => sum + (i.finalAmount || i.amount), 0);
    const debt = overdueInvoices.reduce((sum, i) => sum + (i.finalAmount || i.amount), 0);

    const activeSubscriptions = await this.subscriptionModel.countDocuments({ status: 'ACTIVE' });
    const avgPerStudent = activeSubscriptions > 0 ? Math.round(collected / activeSubscriptions) : 0;

    return {
      collected,
      expected: collected + expected,
      debt,
      avgPerStudent,
      invoicesPaid: paidInvoices.length,
      invoicesPending: pendingInvoices.length,
      invoicesOverdue: overdueInvoices.length,
    };
  }

  // ==================== RENEWAL CHECK (for CRON) ====================

  async checkRenewals() {
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    // Find subscriptions ending soon
    const expiringSoon = await this.subscriptionModel.find({
      status: 'ACTIVE',
      endDate: { $lte: fiveDaysFromNow },
      renewalReminderSent: false,
    });

    for (const sub of expiringSoon) {
      await this.subscriptionModel.updateOne(
        { _id: sub._id },
        { $set: { status: 'RENEWAL_SOON', renewalReminderSent: true } }
      );

      // Create renewal invoice (with dedup guard inside createInvoice)
      await this.createInvoice({
        childId: sub.childId,
        parentId: sub.parentId,
        subscriptionId: sub._id.toString(),
        amount: sub.finalPrice,
        description: `Продовження: ${sub.planName}`,
        dueDate: sub.endDate,
      });
    }

    // Mark expired
    await this.subscriptionModel.updateMany(
      { status: { $in: ['ACTIVE', 'RENEWAL_SOON'] }, endDate: { $lt: new Date() } },
      { $set: { status: 'EXPIRED' } }
    );

    return { processed: expiringSoon.length };
  }
}
