import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OfferVariant, OfferVariantDocument, OfferSegment } from '../../schemas/offer-variant.schema';

@Injectable()
export class GrowthEngineService {
  private readonly logger = new Logger(GrowthEngineService.name);

  constructor(
    @InjectModel(OfferVariant.name) private offerModel: Model<OfferVariantDocument>,
  ) {}

  /**
   * Pick best offer using epsilon-greedy algorithm
   * 20% exploration (random), 80% exploitation (best CR)
   */
  async pickOffer(tenantId: string, segment: OfferSegment): Promise<OfferVariantDocument | null> {
    const offers = await this.offerModel.find({
      tenantId,
      segment,
      isActive: true,
    });

    if (!offers.length) {
      // Return default offer if no variants configured
      return this.getDefaultOffer(segment);
    }

    // Epsilon-greedy: 20% explore, 80% exploit
    const explore = Math.random() < 0.2;

    if (explore) {
      // Random selection for exploration
      const randomIndex = Math.floor(Math.random() * offers.length);
      return offers[randomIndex];
    }

    // Exploit: select best conversion rate
    const sorted = offers.sort((a, b) => {
      const crA = a.views > 0 ? a.conversions / a.views : 0;
      const crB = b.views > 0 ? b.conversions / b.views : 0;
      if (crB !== crA) return crB - crA;
      return a.priority - b.priority; // Lower priority number = higher priority
    });

    return sorted[0];
  }

  /**
   * Track when offer is shown to user
   */
  async trackView(offerId: string): Promise<void> {
    await this.offerModel.updateOne(
      { _id: offerId },
      { $inc: { views: 1 } }
    );
    this.logger.debug(`Tracked view for offer ${offerId}`);
  }

  /**
   * Track when offer converts (payment completed)
   */
  async trackConversion(offerId: string): Promise<void> {
    await this.offerModel.updateOne(
      { _id: offerId },
      { $inc: { conversions: 1 } }
    );
    this.logger.log(`Tracked conversion for offer ${offerId}`);
  }

  /**
   * Get default offer for segment if no variants configured
   */
  private async getDefaultOffer(segment: OfferSegment): Promise<OfferVariantDocument | null> {
    const defaults: Record<OfferSegment, { discount: number; title: string; description: string }> = {
      CHURN_RISK: {
        discount: 30,
        title: 'Ми сумуємо за вами',
        description: 'Поверніться до занять цього місяця та отримайте знижку',
      },
      WARNING: {
        discount: 15,
        title: 'Підтримайте активність',
        description: 'Регулярні тренування - ключ до успіху',
      },
      VIP: {
        discount: 10,
        title: 'Дякуємо за лояльність',
        description: 'Спеціальна знижка для наших найкращих учнів',
      },
      ACTIVE: {
        discount: 5,
        title: 'Бонус для активних',
        description: 'Невеликий бонус за вашу активність',
      },
      NEW: {
        discount: 20,
        title: 'Ласкаво просимо!',
        description: 'Знижка для нових членів клубу',
      },
    };

    const config = defaults[segment];
    if (!config) return null;

    // Create virtual offer (not saved to DB)
    return {
      _id: `default_${segment}`,
      tenantId: 'default',
      name: `Default ${segment} Offer`,
      segment,
      discountPercent: config.discount,
      title: config.title,
      description: config.description,
      isActive: true,
      views: 0,
      conversions: 0,
      priority: 100,
      ttlHours: 72,
    } as any;
  }

  /**
   * Get all offers with stats for admin dashboard
   */
  async getOffersStats(tenantId: string): Promise<any[]> {
    const offers = await this.offerModel.find({ tenantId }).sort({ segment: 1, priority: 1 });
    
    return offers.map(offer => ({
      _id: offer._id,
      name: offer.name,
      segment: offer.segment,
      discountPercent: offer.discountPercent,
      title: offer.title,
      views: offer.views,
      conversions: offer.conversions,
      conversionRate: offer.views > 0 ? ((offer.conversions / offer.views) * 100).toFixed(1) : '0.0',
      isActive: offer.isActive,
      priority: offer.priority,
    }));
  }

  /**
   * Create new offer variant
   */
  async createOffer(data: Partial<OfferVariant>): Promise<OfferVariantDocument> {
    return this.offerModel.create(data);
  }

  /**
   * Update offer
   */
  async updateOffer(id: string, data: Partial<OfferVariant>): Promise<OfferVariantDocument | null> {
    return this.offerModel.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Disable underperforming offers (CR < threshold after min views)
   */
  async autoOptimize(tenantId: string, minViews: number = 50, minCR: number = 0.05): Promise<number> {
    const underperforming = await this.offerModel.find({
      tenantId,
      isActive: true,
      views: { $gte: minViews },
      $expr: {
        $lt: [
          { $divide: ['$conversions', '$views'] },
          minCR
        ]
      }
    });

    if (underperforming.length > 0) {
      await this.offerModel.updateMany(
        { _id: { $in: underperforming.map(o => o._id) } },
        { isActive: false }
      );
      this.logger.warn(`Auto-disabled ${underperforming.length} underperforming offers`);
    }

    return underperforming.length;
  }

  /**
   * Seed default offers for new tenant
   */
  async seedDefaultOffers(tenantId: string): Promise<void> {
    const existing = await this.offerModel.countDocuments({ tenantId });
    if (existing > 0) return;

    const defaultOffers = [
      // CHURN_RISK variants
      { tenantId, name: 'Churn Save A', segment: 'CHURN_RISK', discountPercent: 20, title: 'Повертайтесь до нас!', description: 'Спеціальна пропозиція для вас', priority: 1, ttlHours: 72 },
      { tenantId, name: 'Churn Save B', segment: 'CHURN_RISK', discountPercent: 30, title: 'Ми сумуємо за вами', description: 'Поверніться зі знижкою', priority: 2, ttlHours: 72 },
      { tenantId, name: 'Churn Save C', segment: 'CHURN_RISK', discountPercent: 40, title: 'Особлива пропозиція', description: 'Тільки для вас', priority: 3, ttlHours: 48 },
      
      // WARNING variants
      { tenantId, name: 'Warning A', segment: 'WARNING', discountPercent: 10, title: 'Залишайтесь активними', description: 'Бонус за активність', priority: 1, ttlHours: 48 },
      { tenantId, name: 'Warning B', segment: 'WARNING', discountPercent: 15, title: 'Підтримка активності', description: 'Знижка на продовження', priority: 2, ttlHours: 48 },
      
      // VIP variants
      { tenantId, name: 'VIP Loyalty', segment: 'VIP', discountPercent: 10, title: 'VIP бонус', description: 'Дякуємо за лояльність', priority: 1, ttlHours: 168 },
    ];

    await this.offerModel.insertMany(defaultOffers);
    this.logger.log(`Seeded ${defaultOffers.length} default offers for tenant ${tenantId}`);
  }

  // ==================== ADVANCED GROWTH ANALYTICS ====================

  /**
   * Get retention funnel analytics
   */
  async getRetentionFunnel(tenantId: string): Promise<any> {
    // Mock data for now - will be replaced with real aggregation
    return {
      active: 80,
      warning: 25,
      churnRisk: 15,
      offersShown: 12,
      returned: 7,
      paid: 5,
      conversionRate: 41.7, // returned / offersShown * 100
    };
  }

  /**
   * Get discount efficiency analytics
   */
  async getDiscountEfficiency(tenantId: string): Promise<any> {
    const offers = await this.offerModel.find({ tenantId });
    
    const totalDiscountGiven = offers.reduce((sum, o) => {
      // Estimate: avg payment 2000 * discount% * conversions
      return sum + (2000 * (o.discountPercent / 100) * o.conversions);
    }, 0);

    const revenueRecovered = offers.reduce((sum, o) => {
      // Estimate: avg payment 2000 * conversions
      return sum + (2000 * o.conversions);
    }, 0);

    return {
      totalDiscountGiven: Math.round(totalDiscountGiven),
      revenueRecovered: Math.round(revenueRecovered),
      net: Math.round(revenueRecovered - totalDiscountGiven),
      savedUsers: offers.reduce((sum, o) => sum + o.conversions, 0),
      avgDiscountPercent: offers.length > 0 
        ? Math.round(offers.reduce((sum, o) => sum + o.discountPercent, 0) / offers.length)
        : 0,
    };
  }

  /**
   * Get referral analytics
   */
  async getReferralAnalytics(tenantId: string): Promise<any> {
    // Mock data - would need ReferralCode schema
    return {
      codesIssued: 45,
      codesActivated: 18,
      registrations: 12,
      paidConversions: 8,
      revenueFromReferrals: 16000,
      avgReferralValue: 2000,
    };
  }

  /**
   * Get program analytics by type
   */
  async getProgramAnalytics(tenantId: string): Promise<any[]> {
    // Mock data - would need to join Children with Programs
    return [
      { program: 'KIDS', activeStudents: 45, churnRate: 8.5, arpu: 1800, avgAttendance: 78 },
      { program: 'SPECIAL', activeStudents: 20, churnRate: 5.2, arpu: 2500, avgAttendance: 85 },
      { program: 'SELF_DEFENSE', activeStudents: 15, churnRate: 12.0, arpu: 2200, avgAttendance: 72 },
      { program: 'MENTORSHIP', activeStudents: 8, churnRate: 3.5, arpu: 4000, avgAttendance: 92 },
    ];
  }

  /**
   * Get coach performance analytics
   */
  async getCoachPerformance(tenantId: string): Promise<any[]> {
    // Mock data - would need to aggregate from multiple collections
    return [
      { 
        coachId: '1', 
        name: 'Олександр',
        studentsCount: 32,
        attendanceCompletion: 85,
        recoveryRate: 78,
        savedUsers: 5,
        personalBookingRevenue: 12000,
        competitionResults: { gold: 3, silver: 2, bronze: 1 }
      },
      { 
        coachId: '2', 
        name: 'Максим',
        studentsCount: 28,
        attendanceCompletion: 92,
        recoveryRate: 82,
        savedUsers: 3,
        personalBookingRevenue: 8000,
        competitionResults: { gold: 2, silver: 4, bronze: 2 }
      },
    ];
  }

  /**
   * Get competition analytics
   */
  async getCompetitionAnalytics(tenantId: string): Promise<any> {
    // Mock data - would need Competition schema aggregation
    return {
      totalCompetitions: 12,
      totalRegistrations: 156,
      paidParticipation: 142,
      revenueFromCompetitions: 85200,
      medalDistribution: { gold: 15, silver: 18, bronze: 24 },
      retentionUplift: 12.5, // % improvement in retention after competition
      ratingUplift: 8.3, // % improvement in student ratings
    };
  }

  /**
   * Get aggregated growth overview
   */
  async getGrowthOverview(tenantId: string): Promise<any> {
    const [offers, funnel, efficiency, referrals] = await Promise.all([
      this.getOffersStats(tenantId),
      this.getRetentionFunnel(tenantId),
      this.getDiscountEfficiency(tenantId),
      this.getReferralAnalytics(tenantId),
    ]);

    const totalViews = offers.reduce((sum, o) => sum + o.views, 0);
    const totalConversions = offers.reduce((sum, o) => sum + o.conversions, 0);
    const overallCR = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0.0';

    return {
      offers: {
        total: offers.length,
        active: offers.filter(o => o.isActive).length,
        totalViews,
        totalConversions,
        overallConversionRate: overallCR,
      },
      funnel,
      efficiency,
      referrals,
      kpi: {
        savedRevenue: efficiency.revenueRecovered,
        netRecovery: efficiency.net,
        savedUsers: efficiency.savedUsers,
        referralRevenue: referrals.revenueFromReferrals,
      },
    };
  }
}
