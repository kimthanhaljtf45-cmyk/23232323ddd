import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Alert, AlertDocument } from '../../schemas/alert.schema';

export interface ReconciliationIssue {
  type: 'MISSING_INVOICE' | 'DUPLICATE_INVOICE' | 'AMOUNT_MISMATCH' | 'ORPHAN_INVOICE' | 'EXPIRED_ACTIVE';
  subId?: string;
  invoiceId?: string;
  details?: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
  ) {}

  /**
   * Daily reconciliation at 3:00 AM Kyiv time
   * Checks for billing inconsistencies
   */
  @Cron('0 3 * * *', {
    name: 'billingReconciliation',
    timeZone: 'Europe/Kiev',
  })
  async reconcile(): Promise<ReconciliationIssue[]> {
    this.logger.log('Starting billing reconciliation...');
    const issues: ReconciliationIssue[] = [];

    try {
      // 1. Check active subscriptions without invoices
      const activeSubs = await this.subscriptionModel.find({ status: 'ACTIVE' }).lean();
      
      for (const sub of activeSubs) {
        const invoices = await this.invoiceModel.find({
          subscriptionId: sub._id.toString(),
        }).lean();

        // No invoice for active subscription
        if (invoices.length === 0) {
          issues.push({
            type: 'MISSING_INVOICE',
            subId: sub._id.toString(),
            details: `Active subscription has no invoices. Child: ${sub.childId}`,
            severity: 'CRITICAL',
          });
        }

        // Duplicate pending/overdue invoices
        const pendingInvoices = invoices.filter(
          (inv: any) => inv.status === 'PENDING' || inv.status === 'OVERDUE'
        );
        if (pendingInvoices.length > 1) {
          issues.push({
            type: 'DUPLICATE_INVOICE',
            subId: sub._id.toString(),
            details: `${pendingInvoices.length} pending/overdue invoices found. Should be max 1.`,
            severity: 'WARNING',
          });
        }

        // Amount mismatch
        for (const inv of invoices) {
          const invAmount = (inv as any).amount || (inv as any).finalAmount;
          if (invAmount && sub.price && Math.abs(invAmount - sub.price) > 1) {
            issues.push({
              type: 'AMOUNT_MISMATCH',
              subId: sub._id.toString(),
              invoiceId: (inv as any)._id.toString(),
              details: `Invoice amount ${invAmount} != subscription price ${sub.price}`,
              severity: 'WARNING',
            });
          }
        }
      }

      // 2. Check for expired subscriptions still marked as ACTIVE
      const now = new Date();
      const expiredActive = await this.subscriptionModel.find({
        status: 'ACTIVE',
        endDate: { $lt: now },
      }).lean();

      for (const sub of expiredActive) {
        issues.push({
          type: 'EXPIRED_ACTIVE',
          subId: sub._id.toString(),
          details: `Subscription ended ${(sub as any).endDate} but still marked ACTIVE`,
          severity: 'CRITICAL',
        });
      }

      // 3. Orphan invoices (invoice without valid subscription)
      const allInvoices = await this.invoiceModel.find({
        subscriptionId: { $exists: true, $ne: null },
        status: { $in: ['PENDING', 'OVERDUE'] },
      }).lean();

      for (const inv of allInvoices) {
        const sub = await this.subscriptionModel.findById((inv as any).subscriptionId);
        if (!sub) {
          issues.push({
            type: 'ORPHAN_INVOICE',
            invoiceId: (inv as any)._id.toString(),
            details: `Invoice references non-existent subscription ${(inv as any).subscriptionId}`,
            severity: 'WARNING',
          });
        }
      }

      // Save issues as alerts
      if (issues.length > 0) {
        this.logger.warn(`BILLING RECONCILIATION: ${issues.length} issues found`);
        
        await this.alertModel.create({
          type: 'BILLING_RECONCILIATION',
          severity: issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : 'WARNING',
          title: `Billing reconciliation: ${issues.length} issues`,
          description: JSON.stringify(issues.slice(0, 10)),
          metadata: { issues, totalIssues: issues.length },
          status: 'ACTIVE',
          createdAt: new Date(),
        });
      } else {
        this.logger.log('Billing reconciliation complete - no issues found');
      }

      return issues;
    } catch (error) {
      this.logger.error('Billing reconciliation failed:', error);
      return issues;
    }
  }

  /**
   * Get latest reconciliation results (for admin dashboard)
   */
  async getLatestReconciliation(): Promise<{
    lastRun: Date | null;
    issues: ReconciliationIssue[];
    totalIssues: number;
    critical: number;
    warning: number;
  }> {
    const latestAlert = await this.alertModel.findOne({
      type: 'BILLING_RECONCILIATION',
    }).sort({ createdAt: -1 }).lean();

    if (!latestAlert) {
      return {
        lastRun: null,
        issues: [],
        totalIssues: 0,
        critical: 0,
        warning: 0,
      };
    }

    const issues: ReconciliationIssue[] = (latestAlert as any).metadata?.issues || [];
    return {
      lastRun: (latestAlert as any).createdAt,
      issues,
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'CRITICAL').length,
      warning: issues.filter(i => i.severity === 'WARNING').length,
    };
  }

  /**
   * Run reconciliation manually (admin action)
   */
  async runManual(): Promise<ReconciliationIssue[]> {
    return this.reconcile();
  }
}
