import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument, OfferType } from '../../schemas/offer.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { RetentionSnapshot, RetentionSnapshotDocument } from '../../schemas/retention-snapshot.schema';
import { DiscountsService } from '../discounts/discounts.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(RetentionSnapshot.name) private retentionModel: Model<RetentionSnapshotDocument>,
    private discountsService: DiscountsService,
    private notificationsService: NotificationsService,
  ) {}

  // ==================== RETENTION → OFFER FLOW ====================

  /**
   * RetentionEngine calls this to generate an offer based on risk score
   * This is the P4 core: student at risk → system creates offer → parent sees it
   */
  async getRetentionOffer(context: {
    riskScore: number;
    debtAmount: number;
    monthsActive: number;
  }): Promise<{ type: OfferType; message: string; discount: number; title: string } | null> {
    if (context.riskScore > 70) {
      return {
        type: 'CRITICAL_SAVE',
        title: 'Спеціальна пропозиція',
        message: 'Знижка 20% якщо оплатите сьогодні',
        discount: 20,
      };
    }

    if (context.riskScore > 50) {
      return {
        type: 'MEDIUM_SAVE',
        title: 'Пропозиція для вас',
        message: 'Знижка 10% на продовження',
        discount: 10,
      };
    }

    return null;
  }

  /**
   * Run retention analysis and create offers for at-risk students
   * Called by CRON or manual trigger POST /api/system/retention/run
   */
  async runRetentionOffers(): Promise<{ offersCreated: number; studentsAnalyzed: number }> {
    this.logger.log('Running retention offer generation...');
    
    let offersCreated = 0;
    let studentsAnalyzed = 0;

    // Get all children with retention snapshots
    const snapshots = await this.retentionModel.find({
      dropOffRisk: { $in: ['warning', 'critical'] },
    }).exec();

    for (const snapshot of snapshots) {
      studentsAnalyzed++;

      // Check if there's already an active offer for this student
      const existingOffer = await this.offerModel.findOne({
        studentId: snapshot.entityId,
        status: 'ACTIVE',
        expiresAt: { $gte: new Date() },
      });

      if (existingOffer) continue; // Don't create duplicate

      const riskScore = snapshot.riskScore || 0;

      const offer = await this.getRetentionOffer({
        riskScore,
        debtAmount: 0,
        monthsActive: 3,
      });

      if (offer) {
        // Find parent for this child
        let parentId: string | undefined;
        if (snapshot.entityType === 'CHILD') {
          const child = await this.childModel.findById(snapshot.entityId);
          if (child?.userId) {
            parentId = child.userId;
          }
        }

        await this.offerModel.create({
          studentId: snapshot.entityId,
          parentId,
          type: offer.type,
          discountPercent: offer.discount,
          title: offer.title,
          message: offer.message,
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          status: 'ACTIVE',
          accepted: false,
          riskScore,
        });

        offersCreated++;

        // Send notification to parent
        if (parentId) {
          try {
            await this.notificationsService.notifyUser(
              parentId,
              'OFFER',
              offer.title,
              offer.message || '',
            );
          } catch (e) {
            this.logger.warn(`Failed to send notification: ${e}`);
          }
        }
      }
    }

    this.logger.log(`Retention offers: analyzed=${studentsAnalyzed}, created=${offersCreated}`);
    return { offersCreated, studentsAnalyzed };
  }

  // ==================== PARENT ENDPOINTS ====================

  /**
   * GET /api/parent/offers — list active offers for parent
   */
  async getParentOffers(parentId: string): Promise<any[]> {
    // Get children linked to this parent
    const children = await this.childModel.find({ userId: parentId });
    const childIds = children.map(c => (c as any)._id.toString());

    // Get offers for parent's children + direct parent offers
    const now = new Date();
    const offers = await this.offerModel.find({
      $or: [
        { studentId: { $in: childIds } },
        { parentId },
      ],
      status: 'ACTIVE',
      expiresAt: { $gte: now },
    }).sort({ createdAt: -1 });

    return offers.map(o => ({
      id: (o as any)._id.toString(),
      studentId: o.studentId,
      type: o.type,
      discountPercent: o.discountPercent,
      title: o.title,
      message: o.message,
      expiresAt: o.expiresAt,
      status: o.status,
      accepted: o.accepted,
    }));
  }

  /**
   * POST /api/parent/offers/:id/accept — parent accepts the offer
   * → creates discount rule → recalculates pending invoice
   */
  async acceptOffer(offerId: string, parentId: string): Promise<{
    success: boolean;
    message: string;
    discountApplied?: number;
    invoiceUpdated?: boolean;
  }> {
    const offer = await this.offerModel.findById(offerId);
    if (!offer) throw new NotFoundException('Оффер не знайдено');
    if (offer.status !== 'ACTIVE') {
      return { success: false, message: 'Оффер вже використано або прострочено' };
    }
    if (new Date() > offer.expiresAt) {
      offer.status = 'EXPIRED';
      await offer.save();
      return { success: false, message: 'Оффер прострочено' };
    }

    // Mark offer as accepted
    offer.accepted = true;
    offer.acceptedAt = new Date();
    offer.status = 'ACCEPTED';

    // Create a personal discount rule via DiscountEngine
    const discountRule = await this.discountsService.createMetaDiscountSafe({
      tenantId: 'default',
      userId: parentId,
      value: offer.discountPercent,
      reason: `Retention offer: ${offer.type}`,
      title: offer.title,
      description: offer.message,
      ttlHours: 48,
      offerId: offerId,
    });

    offer.discountRuleId = (discountRule as any)._id.toString();

    // Try to apply discount to pending invoice
    let invoiceUpdated = false;
    const pendingInvoice = await this.invoiceModel.findOne({
      $or: [
        { parentId },
        { childId: offer.studentId },
      ],
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ createdAt: -1 });

    if (pendingInvoice) {
      const originalAmount = pendingInvoice.amount || 0;
      const discountAmount = Math.round(originalAmount * offer.discountPercent / 100);
      const newFinalAmount = originalAmount - discountAmount;

      pendingInvoice.discountAmount = discountAmount;
      pendingInvoice.finalAmount = newFinalAmount;
      await pendingInvoice.save();

      offer.appliedInvoiceId = (pendingInvoice as any)._id.toString();
      invoiceUpdated = true;
    }

    await offer.save();

    return {
      success: true,
      message: `Знижка ${offer.discountPercent}% застосована`,
      discountApplied: offer.discountPercent,
      invoiceUpdated,
    };
  }

  // ==================== ADMIN ENDPOINTS ====================

  async getAdminOfferStats(): Promise<{
    totalOffers: number;
    activeOffers: number;
    acceptedOffers: number;
    expiredOffers: number;
    totalSaved: number;
    acceptRate: number;
  }> {
    const totalOffers = await this.offerModel.countDocuments();
    const activeOffers = await this.offerModel.countDocuments({ status: 'ACTIVE' });
    const acceptedOffers = await this.offerModel.countDocuments({ status: 'ACCEPTED' });
    const expiredOffers = await this.offerModel.countDocuments({ status: 'EXPIRED' });

    // Calculate total saved from accepted offers
    const accepted = await this.offerModel.find({ status: 'ACCEPTED' });
    let totalSaved = 0;
    for (const offer of accepted) {
      if (offer.appliedInvoiceId) {
        const invoice = await this.invoiceModel.findById(offer.appliedInvoiceId);
        if (invoice) {
          totalSaved += invoice.discountAmount || 0;
        }
      }
    }

    const acceptRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

    return {
      totalOffers,
      activeOffers,
      acceptedOffers,
      expiredOffers,
      totalSaved,
      acceptRate,
    };
  }

  async getAllOffers(includeExpired = false): Promise<any[]> {
    const filter: any = {};
    if (!includeExpired) {
      filter.status = { $ne: 'EXPIRED' };
    }
    const offers = await this.offerModel.find(filter).sort({ createdAt: -1 }).limit(100);
    return offers.map(o => ({
      id: (o as any)._id.toString(),
      studentId: o.studentId,
      parentId: o.parentId,
      type: o.type,
      discountPercent: o.discountPercent,
      title: o.title,
      message: o.message,
      expiresAt: o.expiresAt,
      status: o.status,
      accepted: o.accepted,
      acceptedAt: o.acceptedAt,
      riskScore: o.riskScore,
    }));
  }

  /**
   * Expire outdated offers (CRON)
   */
  async expireOffers(): Promise<number> {
    const now = new Date();
    const result = await this.offerModel.updateMany(
      { status: 'ACTIVE', expiresAt: { $lt: now } },
      { $set: { status: 'EXPIRED' } },
    );
    return result.modifiedCount;
  }
}
