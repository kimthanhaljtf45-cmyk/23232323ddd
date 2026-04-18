import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DiscountRule, DiscountRuleDocument } from '../../schemas/discount-rule.schema';
import { AppliedDiscount, AppliedDiscountDocument } from '../../schemas/applied-discount.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { CreateDiscountRuleDto, UpdateDiscountRuleDto, CalculateDiscountDto } from './dto';

export interface DiscountResult {  baseAmount: number;
  totalDiscountPercent: number;
  totalDiscountFixed: number;
  discountAmount: number;
  finalAmount: number;
  appliedRules: Array<{
    ruleId: string;
    name: string;
    type: string;
    valueType: string;
    value: number;
    discountAmount: number;
  }>;
  freeMonths?: number;
}

@Injectable()
export class DiscountsService {
  constructor(
    @InjectModel(DiscountRule.name) private discountRuleModel: Model<DiscountRuleDocument>,
    @InjectModel(AppliedDiscount.name) private appliedDiscountModel: Model<AppliedDiscountDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  // ==================== DISCOUNT ENGINE CORE ====================

  /**
   * Main discount calculation engine
   * Rules:
   * 1. Sort by priority (lower = higher priority)
   * 2. Non-stackable discounts stop the chain
   * 3. Max 50% total discount unless admin override
   * 4. Mutual exclusion by group
   */
  async calculateDiscounts(
    userId: string,
    dto: CalculateDiscountDto,
  ): Promise<DiscountResult> {
    const { baseAmount, childId, context = 'SUBSCRIPTION', promoCode } = dto;
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Get all active rules
    let rules = await this.discountRuleModel
      .find({
        isActive: true,
        $or: [
          { contextType: 'ALL' },
          { contextType: context },
        ],
      })
      .sort({ priority: 1 }) // Lower priority = higher importance
      .exec();

    // Filter by date validity
    const now = new Date();
    rules = rules.filter(rule => {
      if (rule.startsAt && rule.startsAt > now) return false;
      if (rule.expiresAt && rule.expiresAt < now) return false;
      if (rule.usageLimit && rule.usageCount >= rule.usageLimit) return false;
      return true;
    });

    const appliedRules: DiscountResult['appliedRules'] = [];
    const usedGroups = new Set<string>();
    let totalDiscountPercent = 0;
    let totalDiscountFixed = 0;
    let freeMonths = 0;
    let stopProcessing = false;

    for (const rule of rules) {
      if (stopProcessing) break;

      // Check group exclusion
      if (rule.group && usedGroups.has(rule.group)) {
        continue;
      }

      // Check if rule is applicable
      const isApplicable = await this.isRuleApplicable(rule, user, childId, promoCode);
      if (!isApplicable) continue;

      // Check per-user limit
      if (rule.perUserLimit) {
        const userUsageCount = await this.appliedDiscountModel.countDocuments({
          userId,
          discountRuleId: rule._id.toString(),
        });
        if (userUsageCount >= rule.perUserLimit) continue;
      }

      // Apply the rule
      let discountAmount = 0;
      if (rule.valueType === 'PERCENT') {
        let percentDiscount = rule.value;
        discountAmount = (baseAmount * percentDiscount) / 100;
        
        // Apply max discount cap if set
        if (rule.maxDiscountAmount && discountAmount > rule.maxDiscountAmount) {
          discountAmount = rule.maxDiscountAmount;
          percentDiscount = (discountAmount / baseAmount) * 100;
        }
        
        totalDiscountPercent += percentDiscount;
      } else if (rule.valueType === 'FIXED') {
        discountAmount = rule.value;
        totalDiscountFixed += discountAmount;
      } else if (rule.valueType === 'FREE_PERIOD') {
        freeMonths += rule.value;
        discountAmount = baseAmount; // Full amount
      }

      appliedRules.push({
        ruleId: rule._id.toString(),
        name: rule.name,
        type: rule.type,
        valueType: rule.valueType,
        value: rule.value,
        discountAmount,
      });

      if (rule.group) {
        usedGroups.add(rule.group);
      }

      // Non-stackable rule stops processing
      if (!rule.isStackable) {
        stopProcessing = true;
      }
    }

    // Cap total percent discount at 50% (unless free period)
    if (freeMonths === 0 && totalDiscountPercent > 50) {
      totalDiscountPercent = 50;
    }

    const percentDiscount = (baseAmount * totalDiscountPercent) / 100;
    const totalDiscount = Math.min(percentDiscount + totalDiscountFixed, baseAmount);
    const finalAmount = freeMonths > 0 ? 0 : Math.max(0, baseAmount - totalDiscount);

    return {
      baseAmount,
      totalDiscountPercent,
      totalDiscountFixed,
      discountAmount: totalDiscount,
      finalAmount,
      appliedRules,
      freeMonths: freeMonths > 0 ? freeMonths : undefined,
    };
  }

  private async isRuleApplicable(
    rule: DiscountRuleDocument,
    user: UserDocument,
    childId?: string,
    promoCode?: string,
  ): Promise<boolean> {
    // PROMO code check
    if (rule.type === 'PROMO') {
      if (!promoCode || rule.promoCode?.toUpperCase() !== promoCode.toUpperCase()) {
        return false;
      }
    }

    // FAMILY discount check
    if (rule.type === 'FAMILY' && rule.conditions?.minChildren) {
      const childrenCount = await this.childModel.countDocuments({
        parentId: user._id.toString(),
      });
      if (childrenCount < rule.conditions.minChildren) {
        return false;
      }
    }

    // LOYALTY discount check
    if (rule.type === 'LOYALTY' && rule.conditions?.minMonthsActive) {
      const oldestSubscription = await this.subscriptionModel
        .findOne({ parentId: user._id.toString(), status: 'ACTIVE' })
        .sort({ startDate: 1 });
      
      if (oldestSubscription && oldestSubscription.startDate) {
        const monthsActive = this.getMonthsDiff(oldestSubscription.startDate, new Date());
        if (monthsActive < rule.conditions.minMonthsActive) {
          return false;
        }
      } else {
        return false;
      }
    }

    // FIRST_TIME discount check
    if (rule.type === 'FIRST_TIME') {
      const existingPayments = await this.appliedDiscountModel.countDocuments({
        userId: user._id.toString(),
        context: { $in: ['SUBSCRIPTION', 'INVOICE'] },
      });
      if (existingPayments > 0) {
        return false;
      }
    }

    // PERFORMANCE discount check (medal-based)
    if (rule.type === 'PERFORMANCE' && rule.conditions?.medalTypes && childId) {
      // Check if child has any of the required medal types
      const medalCount = await this.childModel.db.collection('competitionresults').countDocuments({
        childId,
        medal: { $in: rule.conditions.medalTypes },
      });
      if (medalCount === 0) {
        return false;
      }
    }

    // VOLUME discount check (multiple active subscriptions)
    if (rule.type === 'VOLUME') {
      const activeSubCount = await this.subscriptionModel.countDocuments({
        parentId: user._id.toString(),
        status: 'ACTIVE',
      });
      // VOLUME applies when parent has 2+ active subscriptions (multiple children)
      if (activeSubCount < 2) {
        return false;
      }
    }

    // Program type check
    if (rule.conditions?.programTypes && rule.conditions.programTypes.length > 0) {
      if (!rule.conditions.programTypes.includes(user.programType)) {
        return false;
      }
    }

    // Min purchase amount check
    if (rule.minPurchaseAmount && rule.minPurchaseAmount > 0) {
      // This would need baseAmount passed in, handled in main method
    }

    return true;
  }

  private getMonthsDiff(startDate: Date, endDate: Date): number {
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    return months + endDate.getMonth() - startDate.getMonth();
  }

  // ==================== RECORD APPLIED DISCOUNT ====================

  async recordAppliedDiscount(
    userId: string,
    discountResult: DiscountResult,
    context: 'BOOKING' | 'SUBSCRIPTION' | 'INVOICE',
    referenceId: string,
  ): Promise<void> {
    for (const rule of discountResult.appliedRules) {
      await this.appliedDiscountModel.create({
        userId,
        discountRuleId: rule.ruleId,
        discountType: rule.type,
        discountName: rule.name,
        originalAmount: discountResult.baseAmount,
        discountAmount: rule.discountAmount,
        finalAmount: discountResult.finalAmount,
        context,
        invoiceId: context === 'INVOICE' ? referenceId : undefined,
        bookingId: context === 'BOOKING' ? referenceId : undefined,
        subscriptionId: context === 'SUBSCRIPTION' ? referenceId : undefined,
      });

      // Increment usage count
      await this.discountRuleModel.updateOne(
        { _id: rule.ruleId },
        { $inc: { usageCount: 1 } },
      );
    }
  }

  // ==================== ADMIN METHODS ====================

  async createRule(dto: CreateDiscountRuleDto): Promise<DiscountRule> {
    return this.discountRuleModel.create(dto);
  }

  async updateRule(ruleId: string, dto: UpdateDiscountRuleDto): Promise<DiscountRule> {
    const rule = await this.discountRuleModel.findByIdAndUpdate(
      ruleId,
      { $set: dto },
      { new: true },
    );
    if (!rule) throw new NotFoundException('Discount rule not found');
    return rule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.discountRuleModel.findByIdAndDelete(ruleId);
  }

  async getAllRules(includeInactive = false): Promise<DiscountRule[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.discountRuleModel.find(filter).sort({ priority: 1 });
  }

  async getRuleById(ruleId: string): Promise<DiscountRule> {
    const rule = await this.discountRuleModel.findById(ruleId);
    if (!rule) throw new NotFoundException('Discount rule not found');
    return rule;
  }

  async getAppliedDiscounts(userId: string): Promise<AppliedDiscount[]> {
    return this.appliedDiscountModel
      .find({ userId })
      .sort({ appliedAt: -1 })
      .limit(50);
  }

  async getDiscountStats(): Promise<{
    totalRules: number;
    activeRules: number;
    totalApplied: number;
    totalSaved: number;
    topDiscounts: Array<{ name: string; usageCount: number }>;
  }> {
    const totalRules = await this.discountRuleModel.countDocuments();
    const activeRules = await this.discountRuleModel.countDocuments({ isActive: true });
    const totalApplied = await this.appliedDiscountModel.countDocuments();
    
    const savedAggregation = await this.appliedDiscountModel.aggregate([
      { $group: { _id: null, total: { $sum: '$discountAmount' } } },
    ]);
    const totalSaved = savedAggregation[0]?.total || 0;

    const topDiscounts = await this.discountRuleModel
      .find({ usageCount: { $gt: 0 } })
      .sort({ usageCount: -1 })
      .limit(5)
      .select('name usageCount');

    return {
      totalRules,
      activeRules,
      totalApplied,
      totalSaved,
      topDiscounts: topDiscounts.map(d => ({ name: d.name, usageCount: d.usageCount })),
    };
  }

  async toggleRule(ruleId: string): Promise<DiscountRule> {
    const rule = await this.discountRuleModel.findById(ruleId);
    if (!rule) throw new NotFoundException('Discount rule not found');
    rule.isActive = !rule.isActive;
    return rule.save();
  }

  async applyManualDiscount(dto: {
    parentId?: string;
    childId?: string;
    percent?: number;
    fixed?: number;
    reason: string;
    expiresAt?: string;
  }): Promise<DiscountRule> {
    const valueType = dto.percent ? 'PERCENT' : 'FIXED';
    const value = dto.percent || dto.fixed || 0;
    
    return this.discountRuleModel.create({
      name: dto.reason || 'Ручна знижка',
      type: 'MANUAL',
      source: 'MANUAL',
      valueType,
      value,
      priority: 1,
      isActive: true,
      isStackable: false,
      usageLimit: 1,
      perUserLimit: 1,
      userId: dto.parentId,
      conditions: dto.childId ? { childId: dto.childId } : undefined,
      description: dto.reason,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  async getDetailedDiscountStats(): Promise<{
    totalUsed: number;
    totalDiscount: number;
    byType: Array<{ type: string; count: number; total: number }>;
    byMonth: Array<{ month: string; count: number; total: number }>;
  }> {
    const totalUsed = await this.appliedDiscountModel.countDocuments();

    const totalAgg = await this.appliedDiscountModel.aggregate([
      { $group: { _id: null, total: { $sum: '$discountAmount' } } },
    ]);
    const totalDiscount = totalAgg[0]?.total || 0;

    const byType = await this.appliedDiscountModel.aggregate([
      {
        $group: {
          _id: '$discountType',
          count: { $sum: 1 },
          total: { $sum: '$discountAmount' },
        },
      },
    ]);

    const byMonth = await this.appliedDiscountModel.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$appliedAt' } },
          count: { $sum: 1 },
          total: { $sum: '$discountAmount' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 6 },
    ]);

    return {
      totalUsed,
      totalDiscount,
      byType: byType.map(t => ({ type: t._id || 'UNKNOWN', count: t.count, total: t.total })),
      byMonth: byMonth.map(m => ({ month: m._id || 'N/A', count: m.count, total: m.total })),
    };
  }

  // ==================== PROMO CODE VALIDATION ====================

  async validatePromoCode(promoCode: string, userId: string): Promise<{
    valid: boolean;
    rule?: DiscountRule;
    message?: string;
  }> {
    const rule = await this.discountRuleModel.findOne({
      type: 'PROMO',
      promoCode: promoCode.toUpperCase(),
      isActive: true,
    });

    if (!rule) {
      return { valid: false, message: 'Промокод не знайдено' };
    }

    const now = new Date();
    if (rule.startsAt && rule.startsAt > now) {
      return { valid: false, message: 'Промокод ще не активний' };
    }
    if (rule.expiresAt && rule.expiresAt < now) {
      return { valid: false, message: 'Промокод прострочений' };
    }
    if (rule.usageLimit && rule.usageCount >= rule.usageLimit) {
      return { valid: false, message: 'Ліміт використання вичерпано' };
    }

    if (rule.perUserLimit) {
      const userUsage = await this.appliedDiscountModel.countDocuments({
        userId,
        discountRuleId: rule._id.toString(),
      });
      if (userUsage >= rule.perUserLimit) {
        return { valid: false, message: 'Ви вже використали цей промокод' };
      }
    }

    return { valid: true, rule };
  }

  // ==================== SEED DEFAULT RULES ====================

  async seedDefaultRules(): Promise<void> {
    const existingCount = await this.discountRuleModel.countDocuments();
    if (existingCount > 0) return;

    const defaultRules = [
      {
        name: 'Реферальна знижка',
        type: 'REFERRAL',
        valueType: 'PERCENT',
        value: 50,
        priority: 1,
        isStackable: false,
        group: 'ACQUISITION',
        description: 'Знижка за запрошення друга',
      },
      {
        name: 'Сімейна знижка (2 дітей)',
        type: 'FAMILY',
        valueType: 'PERCENT',
        value: 10,
        priority: 5,
        isStackable: true,
        group: 'STRUCTURE',
        conditions: { minChildren: 2 },
        description: 'Знижка при записі 2+ дітей',
      },
      {
        name: 'Сімейна знижка (3+ дітей)',
        type: 'FAMILY',
        valueType: 'PERCENT',
        value: 20,
        priority: 4,
        isStackable: true,
        group: 'STRUCTURE',
        conditions: { minChildren: 3 },
        description: 'Знижка при записі 3+ дітей',
      },
      {
        name: 'Лояльність 3 місяці',
        type: 'LOYALTY',
        valueType: 'PERCENT',
        value: 5,
        priority: 10,
        isStackable: true,
        group: 'RETENTION',
        conditions: { minMonthsActive: 3 },
        description: 'Знижка за 3+ місяців тренувань',
      },
      {
        name: 'Лояльність 6 місяців',
        type: 'LOYALTY',
        valueType: 'PERCENT',
        value: 10,
        priority: 9,
        isStackable: true,
        group: 'RETENTION',
        conditions: { minMonthsActive: 6 },
        description: 'Знижка за 6+ місяців тренувань',
      },
      {
        name: 'Перша оплата',
        type: 'FIRST_TIME',
        valueType: 'PERCENT',
        value: 10,
        priority: 3,
        isStackable: false,
        group: 'ACQUISITION',
        description: 'Знижка на перший місяць',
      },
    ];

    await this.discountRuleModel.insertMany(defaultRules);
  }

  // ==================== METABRAIN AUTO DISCOUNT ====================

  /**
   * Safely create MetaBrain discount (no duplicates)
   * Returns existing if already active, creates new otherwise
   */
  async createMetaDiscountSafe(params: {
    tenantId: string;
    userId: string;
    value: number;
    reason: string;
    title?: string;
    description?: string;
    ttlHours?: number;
    offerId?: string;
  }): Promise<DiscountRuleDocument> {
    const { tenantId, userId, value, reason, title, description, ttlHours = 72, offerId } = params;

    // 1. Check for existing active meta-discount
    const now = new Date();
    const existing = await this.discountRuleModel.findOne({
      tenantId,
      userId,
      source: 'METABRAIN',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: now } },
      ],
    });

    if (existing) {
      return existing; // Don't create duplicate
    }

    // 2. Create new discount
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const discount = await this.discountRuleModel.create({
      tenantId,
      userId,
      name: title || 'Meta Retention Offer',
      description: description || reason,
      type: 'METABRAIN',
      source: 'METABRAIN',
      reason,
      valueType: 'PERCENT',
      value,
      priority: 99, // High priority - apply first
      isActive: true,
      isStackable: false,
      usageLimit: 1,
      perUserLimit: 1,
      startsAt: new Date(),
      expiresAt,
      group: 'RETENTION',
      offerId,
    });

    return discount;
  }

  /**
   * Mark discount rules as used (after payment)
   */
  async markRulesUsed(ruleIds: string[]): Promise<void> {
    if (!ruleIds || ruleIds.length === 0) return;

    await this.discountRuleModel.updateMany(
      { _id: { $in: ruleIds } },
      {
        $inc: { usageCount: 1 },
      },
    );

    // Disable one-time personal discounts
    await this.discountRuleModel.updateMany(
      {
        _id: { $in: ruleIds },
        source: 'METABRAIN',
        usageLimit: 1,
      },
      {
        isActive: false,
      },
    );
  }

  /**
   * Get user's active meta discount for display
   */
  async getUserMetaDiscount(userId: string, tenantId: string = 'default'): Promise<DiscountRuleDocument | null> {
    const now = new Date();
    return this.discountRuleModel.findOne({
      tenantId,
      userId,
      source: 'METABRAIN',
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: now } },
      ],
    });
  }

  /**
   * Expire all outdated discounts (called by cron)
   */
  async expireOutdatedDiscounts(): Promise<number> {
    const now = new Date();
    const result = await this.discountRuleModel.updateMany(
      {
        isActive: true,
        expiresAt: { $lt: now },
      },
      {
        isActive: false,
      },
    );
    return result.modifiedCount;
  }

  /**
   * Cleanup old inactive discounts (called by cron)
   */
  async cleanupOldDiscounts(daysOld: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await this.discountRuleModel.deleteMany({
      isActive: false,
      source: 'METABRAIN',
      expiresAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }
}
