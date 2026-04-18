import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClubSubscription, ClubSubscriptionDocument } from '../../schemas/club-subscription.schema';
import { ClubInvoice, ClubInvoiceDocument } from '../../schemas/club-invoice.schema';
import { Club, ClubDocument } from '../../schemas/club.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ClubMembership, ClubMembershipDocument } from '../../schemas/club-membership.schema';

const PLAN_PRICE: Record<string, number> = { START: 990, PRO: 2490, ENTERPRISE: 4990 };
const PLAN_LABELS: Record<string, string> = { START: 'Старт', PRO: 'Про', ENTERPRISE: 'All' };

@Injectable()
export class ClubBillingService {
  private readonly logger = new Logger('ClubBilling');

  constructor(
    @InjectModel(ClubSubscription.name) private subModel: Model<ClubSubscriptionDocument>,
    @InjectModel(ClubInvoice.name) private invoiceModel: Model<ClubInvoiceDocument>,
    @InjectModel(Club.name) private clubModel: Model<ClubDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(ClubMembership.name) private membershipModel: Model<ClubMembershipDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const { _id, __v, ...rest } = obj;
    return { id: _id?.toString(), ...rest };
  }

  // === SUBSCRIPTION LIFECYCLE ===

  async createSubscription(clubId: string, plan: string) {
    const price = PLAN_PRICE[plan];
    if (!price) throw new BadRequestException('Invalid plan');

    // Check existing
    const existing = await this.subModel.findOne({ clubId, status: { $in: ['ACTIVE', 'TRIAL'] } });
    if (existing) throw new BadRequestException('Club already has an active subscription');

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setDate(nextBilling.getDate() + 30);

    const sub = await this.subModel.create({
      clubId, plan, price, status: 'ACTIVE',
      startDate: now,
      nextBillingDate: nextBilling,
    });

    // Update club
    await this.clubModel.updateOne({ _id: clubId }, {
      $set: { plan, priceMonthly: price, saasStatus: 'ACTIVE', nextBillingDate: nextBilling },
    });

    // Generate first invoice
    await this.generateInvoice(sub);

    this.logger.log(`Subscription created for club ${clubId}: ${plan} @ ${price}₴`);
    return this.serialize(sub);
  }

  async generateInvoice(sub: ClubSubscriptionDocument | any) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Prevent duplicates
    const exists = await this.invoiceModel.findOne({
      subscriptionId: sub._id?.toString() || sub.id,
      period,
      status: { $in: ['PENDING', 'PAID'] },
    });
    if (exists) return this.serialize(exists);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    const invoice = await this.invoiceModel.create({
      clubId: sub.clubId,
      subscriptionId: sub._id?.toString() || sub.id,
      amount: sub.price,
      plan: sub.plan,
      period,
      description: `SaaS ${PLAN_LABELS[sub.plan] || sub.plan} — ${period}`,
      status: 'PENDING',
      dueDate,
    });

    this.logger.log(`Invoice generated: ${invoice.amount}₴ for club ${sub.clubId}`);
    return this.serialize(invoice);
  }

  async markInvoicePaid(invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') return this.serialize(invoice);

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    await invoice.save();

    // Extend subscription
    const sub = await this.subModel.findById(invoice.subscriptionId);
    if (sub) {
      const next = new Date();
      next.setDate(next.getDate() + 30);
      sub.status = 'ACTIVE';
      sub.nextBillingDate = next;
      sub.lastBilledAt = new Date();
      await sub.save();

      await this.clubModel.updateOne({ _id: invoice.clubId }, {
        $set: { saasStatus: 'ACTIVE', nextBillingDate: next },
      });
    }

    this.logger.log(`Invoice ${invoiceId} marked PAID`);
    return this.serialize(invoice);
  }

  // === UPGRADE / DOWNGRADE ===

  async upgradePlan(clubId: string, newPlan: string) {
    const price = PLAN_PRICE[newPlan];
    if (!price) throw new BadRequestException('Invalid plan');

    const sub = await this.subModel.findOne({ clubId, status: 'ACTIVE' });

    if (sub) {
      sub.plan = newPlan;
      sub.price = price;
      await sub.save();

      // Generate prorated invoice
      await this.generateInvoice(sub);
    } else {
      // Create new subscription
      return this.createSubscription(clubId, newPlan);
    }

    // Update club plan + limits
    const limits: Record<string, any> = {
      START: { maxStudents: 50, maxCoaches: 3, maxBranches: 1 },
      PRO: { maxStudents: 200, maxCoaches: 10, maxBranches: 5 },
      ENTERPRISE: { maxStudents: 9999, maxCoaches: 999, maxBranches: 999 },
    };

    await this.clubModel.updateOne({ _id: clubId }, {
      $set: { plan: newPlan, priceMonthly: price, ...limits[newPlan] },
    });

    this.logger.log(`Club ${clubId} upgraded to ${newPlan}`);
    return this.serialize(sub);
  }

  async cancelSubscription(clubId: string, reason?: string) {
    const sub = await this.subModel.findOne({ clubId, status: 'ACTIVE' });
    if (!sub) throw new NotFoundException('No active subscription');

    sub.status = 'CANCELED';
    sub.canceledAt = new Date();
    sub.cancelReason = reason || '';
    await sub.save();

    await this.clubModel.updateOne({ _id: clubId }, { $set: { saasStatus: 'CANCELED' } });

    return this.serialize(sub);
  }

  // === LIMITS ENFORCEMENT ===

  async enforceLimits(clubId: string, resource: 'students' | 'coaches' | 'branches') {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) throw new NotFoundException('Club not found');

    const sub = await this.subModel.findOne({ clubId, status: 'ACTIVE' });
    if (!sub) throw new BadRequestException('Підписка клубу неактивна. Оновіть план.');

    let current = 0;
    let max = 0;

    switch (resource) {
      case 'students':
        current = await this.childModel.countDocuments({ clubId, isActive: true });
        max = club.maxStudents || 50;
        break;
      case 'coaches':
        current = await this.membershipModel.countDocuments({ clubId, role: 'COACH', status: 'ACTIVE' });
        max = club.maxCoaches || 3;
        break;
      case 'branches':
        current = club.branchCount || 0;
        max = club.maxBranches || 1;
        break;
    }

    if (current >= max) {
      throw new BadRequestException(`Ліміт ${resource} вичерпано (${current}/${max}). Оновіть тарифний план.`);
    }

    return { allowed: true, current, max, usage: Math.round((current / max) * 100) };
  }

  // === BILLING DASHBOARD ===

  async getBillingDashboard(clubId: string) {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) throw new NotFoundException('Club not found');

    const sub = await this.subModel.findOne({ clubId }).sort({ createdAt: -1 }).lean();
    const invoices = await this.invoiceModel.find({ clubId }).sort({ createdAt: -1 }).limit(12).lean();

    const students = await this.childModel.countDocuments({ clubId, isActive: true });
    const coaches = await this.membershipModel.countDocuments({ clubId, role: 'COACH', status: 'ACTIVE' });

    const pendingAmount = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0);
    const paidTotal = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);

    return {
      subscription: sub ? {
        id: (sub as any)._id?.toString(),
        plan: sub.plan,
        planLabel: PLAN_LABELS[sub.plan] || sub.plan,
        status: sub.status,
        price: sub.price,
        nextBillingDate: sub.nextBillingDate,
        startDate: sub.startDate,
        autoRenew: sub.autoRenew,
      } : null,
      limits: {
        students: { current: students, max: club.maxStudents || 50, usage: Math.round((students / (club.maxStudents || 50)) * 100) },
        coaches: { current: coaches, max: club.maxCoaches || 3, usage: Math.round((coaches / (club.maxCoaches || 3)) * 100) },
        branches: { current: club.branchCount || 0, max: club.maxBranches || 1, usage: Math.round(((club.branchCount || 0) / (club.maxBranches || 1)) * 100) },
      },
      invoices: invoices.map(i => ({
        id: (i as any)._id?.toString(),
        amount: i.amount,
        status: i.status,
        plan: i.plan,
        period: i.period,
        dueDate: i.dueDate,
        paidAt: i.paidAt,
        description: i.description,
      })),
      summary: {
        pendingAmount,
        paidTotal,
        currentPlan: club.plan,
        priceMonthly: club.priceMonthly,
      },
    };
  }

  // === CRON: Auto-generate invoices ===

  async billingCron() {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const subs = await this.subModel.find({
      status: 'ACTIVE',
      autoRenew: true,
      nextBillingDate: { $lte: twoDaysFromNow },
    });

    let generated = 0;
    for (const sub of subs) {
      try {
        await this.generateInvoice(sub);
        generated++;
      } catch (e) {
        this.logger.warn(`Failed to generate invoice for sub ${sub._id}: ${e}`);
      }
    }

    this.logger.log(`Billing cron: ${generated} invoices generated`);
    return { generated };
  }

  // === CRON: Mark overdue ===

  async overdueCron() {
    const now = new Date();
    const result = await this.invoiceModel.updateMany(
      { status: 'PENDING', dueDate: { $lt: now } },
      { $set: { status: 'OVERDUE' } },
    );

    // Update clubs with overdue invoices
    const overdueInvoices = await this.invoiceModel.find({ status: 'OVERDUE' }).lean();
    const clubIds = [...new Set(overdueInvoices.map(i => i.clubId))];
    for (const cid of clubIds) {
      await this.clubModel.updateOne({ _id: cid }, { $set: { saasStatus: 'PAST_DUE' } });
      await this.subModel.updateOne({ clubId: cid, status: 'ACTIVE' }, { $set: { status: 'PAST_DUE' } });
    }

    this.logger.log(`Overdue cron: ${result.modifiedCount} invoices marked overdue`);
    return { markedOverdue: result.modifiedCount };
  }
}
