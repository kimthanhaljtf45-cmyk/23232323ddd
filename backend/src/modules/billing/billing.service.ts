import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Child.name)
    private childModel: Model<ChildDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // ============ SUBSCRIPTIONS ============

  /**
   * @deprecated Use SubscriptionsService.create() instead
   * Legacy method kept for backward compatibility
   */
  async createSubscription(
    parentId: string,
    childId: string,
    planName: string,
    price: number,
    dueDay: number,
  ) {
    const today = new Date();
    let nextBilling: Date;

    if (today.getDate() <= dueDay) {
      nextBilling = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
    } else {
      nextBilling = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(dueDay, 28));
    }

    const subscription = await this.subscriptionModel.create({
      childId,
      parentId,
      planName,
      price,
      dueDay,
      startDate: today,
      nextBillingAt: nextBilling,
      status: 'ACTIVE',
    });

    this.logger.log(`Created subscription ${subscription._id} for child ${childId}`);
    return subscription;
  }

  async getSubscriptions(userId: string, role: string) {
    if (role === 'PARENT') {
      return this.subscriptionModel.find({ parentId: userId }).lean();
    }
    return this.subscriptionModel.find().lean();
  }

  async getSubscription(id: string) {
    return this.subscriptionModel.findById(id).lean();
  }

  async updateSubscription(id: string, data: Partial<Subscription>) {
    return this.subscriptionModel.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  // ============ INVOICES ============

  async createInvoiceFromSubscription(subscription: any) {
    // DEDUP GUARD: Check for existing pending/overdue invoice for this subscription
    const existingInvoice = await this.invoiceModel.findOne({
      subscriptionId: subscription._id.toString(),
      status: { $in: ['PENDING', 'OVERDUE'] },
    });
    if (existingInvoice) {
      this.logger.log(`Invoice already exists for subscription ${subscription._id}, skipping`);
      return existingInvoice;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const child = await this.childModel.findById(subscription.childId).lean();
    const childName = child?.firstName || 'Дитина';

    const invoice = await this.invoiceModel.create({
      childId: subscription.childId,
      parentId: subscription.parentId,
      subscriptionId: subscription._id.toString(),
      amount: subscription.price,
      currency: subscription.currency || 'UAH',
      description: `${subscription.planName} - ${childName}`,
      status: 'PENDING',
      dueDate,
    });

    // Update subscription billing dates
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(subscription.dueDay, 28));
    
    await this.subscriptionModel.updateOne(
      { _id: subscription._id },
      { lastBilledAt: today, nextBillingAt: nextMonth },
    );

    // Send notification
    await this.notificationsService.notifyUser(
      subscription.parentId,
      'INVOICE_CREATED',
      'Новий рахунок',
      `Створено рахунок на ${invoice.amount} ${invoice.currency}`,
      { invoiceId: invoice._id.toString(), screen: '/(parent)/payments' },
    );

    this.logger.log(`Generated invoice ${invoice._id} from subscription ${subscription._id}`);
    return invoice;
  }

  async getInvoices(userId: string, role: string, status?: string) {
    const query: any = {};
    if (role === 'PARENT') {
      query.parentId = userId;  // F5 FIX: was userId — must be parentId
    }
    if (status) {
      query.status = status;
    }

    const invoices = await this.invoiceModel.find(query).sort({ createdAt: -1 }).lean();
    
    // Enrich with child info
    for (const inv of invoices) {
      const child = await this.childModel.findById(inv.childId).lean();
      (inv as any).child = child;
    }
    
    return invoices;
  }

  async getInvoice(id: string) {
    const invoice = await this.invoiceModel.findById(id).lean();
    if (invoice) {
      const child = await this.childModel.findById(invoice.childId).lean();
      (invoice as any).child = child;
    }
    return invoice;
  }

  async uploadPaymentProof(invoiceId: string, proofUrl: string, userId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.parentId !== userId) {
      throw new Error('Not authorized');
    }

    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      { proofUrl },
    );

    // Notify admins
    const admins = await this.userModel.find({ role: 'ADMIN' }).lean();
    for (const admin of admins) {
      await this.notificationsService.notifyUser(
        admin._id.toString(),
        'PAYMENT_CONFIRMATION',
        'Підтвердження оплати',
        `Отримано підтвердження оплати на ${invoice.amount} ${invoice.currency}`,
        { invoiceId, screen: '/(admin)/payments' },
      );
    }

    this.logger.log(`Payment proof uploaded for invoice ${invoiceId}`);
  }

  async approvePayment(invoiceId: string, adminNote?: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      { status: 'PAID', paidAt: new Date(), adminNote },
    );

    // Notify parent
    await this.notificationsService.notifyUser(
      invoice.parentId,
      'PAYMENT_APPROVED',
      'Оплату підтверджено',
      `Ваш платіж на ${invoice.amount} ${invoice.currency} підтверджено`,
      { invoiceId, screen: '/(parent)/payments' },
    );

    this.logger.log(`Payment approved for invoice ${invoiceId}`);
  }

  async rejectPayment(invoiceId: string, adminNote?: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      { status: 'PENDING', proofUrl: null, adminNote },
    );

    // Notify parent
    await this.notificationsService.notifyUser(
      invoice.parentId,
      'PAYMENT_REJECTED',
      'Оплату відхилено',
      adminNote || 'Будь ласка, надішліть коректне підтвердження оплати',
      { invoiceId, screen: '/(parent)/payments' },
    );

    this.logger.log(`Payment rejected for invoice ${invoiceId}`);
  }

  // ============ CRON JOBS ============

  async checkAndGenerateInvoices() {
    const today = new Date();
    this.logger.log(`Running billing check at ${today.toISOString()}`);

    const subscriptions = await this.subscriptionModel.find({
      status: 'ACTIVE',
      nextBillingAt: { $lte: today },
    }).lean();

    let generated = 0;
    for (const sub of subscriptions) {
      try {
        await this.createInvoiceFromSubscription(sub);
        generated++;
      } catch (e) {
        this.logger.error(`Failed to generate invoice for subscription ${sub._id}: ${e}`);
      }
    }

    this.logger.log(`Generated ${generated} invoices`);
    return generated;
  }

  async checkOverdueInvoices() {
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdueInvoices = await this.invoiceModel.find({
      status: 'PENDING',
      dueDate: { $lt: today },
    }).lean();

    for (const invoice of overdueInvoices) {
      // Mark as overdue
      await this.invoiceModel.updateOne(
        { _id: invoice._id },
        { status: 'OVERDUE' },
      );

      // +3 days: send reminder
      if (invoice.dueDate < threeDaysAgo && !invoice.overdueReminderSent) {
        await this.notificationsService.notifyUser(
          invoice.parentId,
          'PAYMENT_OVERDUE',
          'Прострочена оплата',
          `Рахунок на ${invoice.amount} ${invoice.currency} прострочено`,
          { invoiceId: invoice._id.toString(), screen: '/(parent)/payments' },
        );

        await this.invoiceModel.updateOne(
          { _id: invoice._id },
          { overdueReminderSent: true },
        );
        this.logger.log(`Sent overdue reminder for invoice ${invoice._id}`);
      }

      // +7 days: escalation
      if (invoice.dueDate < sevenDaysAgo && !invoice.escalationSent) {
        // Alert admins
        const admins = await this.userModel.find({ role: 'ADMIN' }).lean();
        for (const admin of admins) {
          await this.notificationsService.notifyUser(
            admin._id.toString(),
            'ESCALATION',
            'Ескалація: неоплачений рахунок',
            `Рахунок прострочено більше 7 днів`,
            { invoiceId: invoice._id.toString(), screen: '/(admin)/payments' },
          );
        }

        await this.invoiceModel.updateOne(
          { _id: invoice._id },
          { escalationSent: true },
        );
        this.logger.log(`Sent escalation for invoice ${invoice._id}`);
      }
    }
  }

  // ============ STATS ============

  /**
   * F4 FIX: Renewal check — delegates to canonical SubscriptionsService
   * Called by CRON daily at 02:00
   */
  async runRenewalCheck(): Promise<number> {
    this.logger.log('Running renewal check...');
    
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    // Find subscriptions ending soon that haven't had renewal reminder
    const expiringSoon = await this.subscriptionModel.find({
      status: 'ACTIVE',
      endDate: { $lte: fiveDaysFromNow, $gt: new Date() },
      renewalReminderSent: { $ne: true },
    }).lean();

    let processed = 0;
    for (const sub of expiringSoon) {
      // Check for existing PENDING invoice (prevent duplicates)
      const existingInvoice = await this.invoiceModel.findOne({
        subscriptionId: sub._id.toString(),
        status: { $in: ['PENDING', 'OVERDUE'] },
      });

      if (existingInvoice) continue; // Already has pending invoice

      // Create renewal invoice
      const dueDate = new Date(sub.endDate);
      await this.invoiceModel.create({
        childId: sub.childId,
        parentId: sub.parentId,
        subscriptionId: sub._id.toString(),
        amount: sub.finalPrice || sub.price,
        currency: 'UAH',
        description: `Продовження: ${sub.planName || 'абонемент'}`,
        status: 'PENDING',
        dueDate,
      });

      // Mark as RENEWAL_SOON
      await this.subscriptionModel.updateOne(
        { _id: sub._id },
        { $set: { status: 'RENEWAL_SOON', renewalReminderSent: true } },
      );

      // Send notification
      await this.notificationsService.notifyUser(
        sub.parentId,
        'RENEWAL_REMINDER',
        'Підписка закінчується',
        `Підписка "${sub.planName}" закінчується. Будь ласка, оновіть.`,
        { subscriptionId: sub._id.toString(), screen: '/billing' },
      );

      processed++;
    }

    // Expire subscriptions past end date
    await this.subscriptionModel.updateMany(
      { status: { $in: ['ACTIVE', 'RENEWAL_SOON'] }, endDate: { $lt: new Date() } },
      { $set: { status: 'EXPIRED' } },
    );

    this.logger.log(`Renewal check: processed ${processed}, expired overdue subs`);
    return processed;
  }

  // ============ ORIGINAL STATS ============

  async getBillingStats() {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const pendingInvoices = await this.invoiceModel.find({ status: 'PENDING' }).lean();
    const overdueInvoices = await this.invoiceModel.find({ status: 'OVERDUE' }).lean();
    const paidInvoices = await this.invoiceModel.find({
      status: 'PAID',
      paidAt: { $gte: monthStart },
    }).lean();

    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      revenue: {
        paid: paidInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        pending: pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        overdue: overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      },
      alerts: {
        overdue_3_days: overdueInvoices.filter(inv => inv.dueDate < threeDaysAgo).length,
        overdue_7_days: overdueInvoices.filter(inv => inv.dueDate < sevenDaysAgo).length,
      },
      counts: {
        paid: paidInvoices.length,
        pending: pendingInvoices.length,
        overdue: overdueInvoices.length,
      },
    };
  }

  async getPendingReviewInvoices() {
    const invoices = await this.invoiceModel.find({
      status: 'PENDING',
      proofUrl: { $ne: null },
    }).sort({ createdAt: -1 }).lean();

    for (const inv of invoices) {
      const child = await this.childModel.findById(inv.childId).lean();
      const parent = await this.userModel.findById(inv.parentId).lean();
      (inv as any).child = child;
      (inv as any).parent = parent;
    }

    return invoices;
  }
}
