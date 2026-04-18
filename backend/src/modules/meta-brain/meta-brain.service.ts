import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MetaBrainEngine, ChildFeatures, RiskResult } from './meta-brain.engine';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Progress, ProgressDocument } from '../../schemas/progress.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { CoachAction, CoachActionDocument } from '../../schemas/coach-action.schema';
import { DiscountsService } from '../discounts/discounts.service';
import { GrowthEngineService } from '../growth-engine/growth-engine.service';
import { LtvService, LtvProfile } from '../ltv/ltv.service';
import { PredictiveService, PredictionProfile, NextBestAction } from '../predictive/predictive.service';
import { OfferSegment } from '../../schemas/offer-variant.schema';

@Injectable()
export class MetaBrainService {
  constructor(
    private readonly engine: MetaBrainEngine,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(CoachAction.name) private coachActionModel: Model<CoachActionDocument>,
    @Inject(forwardRef(() => DiscountsService)) private discountsService: DiscountsService,
    @Inject(forwardRef(() => GrowthEngineService)) private growthEngine: GrowthEngineService,
    @Inject(forwardRef(() => LtvService)) private ltvService: LtvService,
    @Inject(forwardRef(() => PredictiveService)) private predictiveService: PredictiveService,
  ) {}

  async getChildFeatures(childId: string): Promise<ChildFeatures | null> {
    const child = await this.childModel.findById(childId);
    if (!child) return null;

    const attendance = await this.attendanceModel.find({ childId }).sort({ date: -1 });
    const payments = await this.paymentModel.find({ childId }).sort({ createdAt: -1 });
    const progress = await this.progressModel.findOne({ childId });

    // Calculate attendance rate
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 100;

    // Calculate attendance trend (last 5 vs previous 5)
    const last5 = attendance.slice(0, 5);
    const prev5 = attendance.slice(5, 10);
    const last5Present = last5.filter(a => a.status === 'PRESENT').length;
    const prev5Present = prev5.filter(a => a.status === 'PRESENT').length;
    const attendanceTrend = prev5.length > 0 
      ? (last5Present / Math.max(last5.length, 1)) - (prev5Present / prev5.length)
      : 0;

    // Calculate last visit days
    const lastPresent = attendance.find(a => a.status === 'PRESENT');
    let lastVisitDays = 0;
    if (lastPresent?.date) {
      const lastDate = new Date(lastPresent.date);
      const today = new Date();
      lastVisitDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Payment status
    const latestPayment = payments[0];
    let paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE' | null = null;
    let paymentDelayDays = 0;
    if (latestPayment) {
      if (latestPayment.status === 'PAID') {
        paymentStatus = 'PAID';
      } else if (latestPayment.dueDate) {
        const dueDate = new Date(latestPayment.dueDate);
        const today = new Date();
        paymentDelayDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        paymentStatus = paymentDelayDays > 0 ? 'OVERDUE' : 'PENDING';
      } else {
        paymentStatus = 'PENDING';
      }
    }

    // Absence streak
    let absenceStreak = 0;
    for (const a of attendance) {
      if (a.status === 'ABSENT') absenceStreak++;
      else break;
    }

    // Progress rate
    const progressRate = progress?.progressPercent || 0;

    // Discipline score
    const warnedCount = attendance.filter(a => a.status === 'WARNED').length;
    const lateCount = attendance.filter(a => a.status === 'LATE').length;
    const weighted = presentCount * 1.0 + warnedCount * 0.6 + lateCount * 0.5;
    const disciplineScore = totalAttendance > 0 ? Math.round((weighted / totalAttendance) * 100) : 100;

    return {
      childId: child._id.toString(),
      name: `${child.firstName} ${child.lastName || ''}`.trim(),
      attendanceRate,
      attendanceTrend,
      lastVisitDays,
      paymentStatus,
      paymentDelayDays: Math.max(0, paymentDelayDays),
      progressRate,
      absenceStreak,
      disciplineScore,
      belt: child.belt || 'WHITE',
      groupId: child.groupId,
    };
  }

  async analyzeChild(childId: string): Promise<RiskResult | null> {
    const features = await this.getChildFeatures(childId);
    if (!features) return null;

    return this.engine.calculateRisk(features);
  }

  async getCoachInsights(coachId: string) {
    // Get coach's groups
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());

    // Get children in those groups
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    // Analyze all children
    const risks: RiskResult[] = [];
    for (const child of children) {
      const result = await this.analyzeChild(child._id.toString());
      if (result) risks.push(result);
    }

    // Sort by risk score descending
    risks.sort((a, b) => b.risk - a.risk);

    // Get top risks
    const topRisks = risks.filter(r => r.status === 'critical' || r.status === 'warning').slice(0, 5);

    // Aggregate actions
    const allActions = risks.flatMap(r => r.actions.map(a => ({ ...a, childId: r.childId, childName: r.name })));
    allActions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Generate recommendations
    const recommendations: string[] = [];
    const criticalCount = risks.filter(r => r.status === 'critical').length;
    const warningCount = risks.filter(r => r.status === 'warning').length;

    if (criticalCount > 0) {
      recommendations.push(`${criticalCount} учнів у критичному ризику - потребують негайної уваги`);
    }
    if (warningCount > 3) {
      recommendations.push('Багато учнів у зоні ризику - перевірте причини');
    }

    return {
      totalStudents: children.length,
      criticalCount,
      warningCount,
      goodCount: risks.filter(r => r.status === 'good').length,
      topRisks,
      recommendedActions: allActions.slice(0, 10),
      recommendations,
    };
  }

  async getAdminInsights() {
    const children = await this.childModel.find({});
    const users = await this.userModel.find({});
    const payments = await this.paymentModel.find({});

    // Analyze all children
    const risks: RiskResult[] = [];
    for (const child of children) {
      const result = await this.analyzeChild(child._id.toString());
      if (result) risks.push(result);
    }

    risks.sort((a, b) => b.risk - a.risk);

    // Revenue stats
    const paidPayments = payments.filter(p => p.status === 'PAID');
    const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'UNDER_REVIEW');
    const overduePayments = payments.filter(p => {
      if (p.status === 'PAID') return false;
      if (!p.dueDate) return false;
      return new Date(p.dueDate) < new Date();
    });

    const totalRevenue = paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const pendingRevenue = pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const overdueRevenue = overduePayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    // Churn prediction (children with risk > 70)
    const churnRisk = risks.filter(r => r.risk >= 70);
    const potentialChurnRevenue = churnRisk.length * 2500; // Assume average subscription

    // Calculate predictions
    const totalActiveStudents = children.length;
    const churnProbability = totalActiveStudents > 0 
      ? Math.round((churnRisk.length / totalActiveStudents) * 100) / 100
      : 0;

    return {
      summary: {
        totalStudents: children.length,
        totalParents: users.filter(u => u.role === 'PARENT').length,
        totalCoaches: users.filter(u => u.role === 'COACH').length,
        criticalRisks: risks.filter(r => r.status === 'critical').length,
        warningRisks: risks.filter(r => r.status === 'warning').length,
        healthyStudents: risks.filter(r => r.status === 'good').length,
      },
      revenue: {
        total: totalRevenue,
        pending: pendingRevenue,
        overdue: overdueRevenue,
        atRisk: potentialChurnRevenue,
      },
      predictions: {
        churnProbability,
        churnCount: churnRisk.length,
        expectedRevenueLoss: potentialChurnRevenue,
      },
      topRisks: risks.slice(0, 10),
      weights: this.engine.getWeights(),
    };
  }

  async getParentInsights(parentId: string) {
    // Get parent's children
    const children = await this.childModel.find({ parentId });
    
    if (children.length === 0) {
      return {
        children: [],
        offers: [],
        recommendations: [],
      };
    }

    const childInsights = [];
    for (const child of children) {
      const result = await this.analyzeChild(child._id.toString());
      if (result) {
        childInsights.push({
          childId: result.childId,
          childName: result.name,
          riskScore: result.risk,
          segment: this.getSegmentFromRisk(result.risk),
          attendanceRate: result.features?.attendanceRate || 0,
          missedInRow: result.features?.absenceStreak || 0,
        });
      }
    }

    // Generate offers based on risk
    const offers = [];
    const highRiskChild = childInsights.find(c => c.segment === 'CHURN_RISK');
    if (highRiskChild) {
      offers.push({
        title: 'Ми сумуємо за вами',
        description: 'Поверніться до занять цього місяця та отримайте спеціальну пропозицію.',
        discountLabel: '-30% на наступний місяць',
        childId: highRiskChild.childId,
      });
    }

    const warningChild = childInsights.find(c => c.segment === 'WARNING');
    if (warningChild) {
      offers.push({
        title: 'Залишайтеся активними!',
        description: 'Регулярні тренування - ключ до успіху вашої дитини.',
        discountLabel: '-15% на продовження',
        childId: warningChild.childId,
      });
    }

    // Recommendations
    const recommendations = [];
    for (const child of childInsights) {
      if (child.attendanceRate < 60) {
        recommendations.push({
          type: 'ATTENDANCE',
          text: `${child.childName}: Регулярні тренування допоможуть прогресу`,
          childId: child.childId,
        });
      }
      if (child.missedInRow >= 2) {
        recommendations.push({
          type: 'REMINDER',
          text: `${child.childName}: Пропущено ${child.missedInRow} тренувань`,
          childId: child.childId,
        });
      }
    }

    return {
      children: childInsights,
      offers,
      recommendations,
    };
  }

  private getSegmentFromRisk(risk: number): 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK' {
    if (risk >= 70) return 'CHURN_RISK';
    if (risk >= 40) return 'WARNING';
    if (risk <= 10) return 'VIP';
    return 'ACTIVE';
  }

  /**
   * MAIN DECISION ENGINE - Evaluate user and take action
   * This is called by CRON every 6 hours
   * 
   * NOW INTEGRATED WITH:
   * - LTV Engine (dynamic pricing)
   * - Predictive Engine (next best action)
   */
  async evaluateUser(userId: string, tenantId: string = 'default'): Promise<{
    segment: OfferSegment;
    riskScore: number;
    action: 'DISCOUNT_CREATED' | 'DISCOUNT_EXISTS' | 'NO_ACTION' | 'NOT_WORTH_SAVING' | 'UPSELL_VIP' | 'COACH_ACTION';
    discount?: any;
    ltv?: LtvProfile;
    prediction?: PredictionProfile;
  }> {
    // Get user's children
    const children = await this.childModel.find({ parentId: userId });
    if (children.length === 0) {
      return { segment: 'ACTIVE', riskScore: 0, action: 'NO_ACTION' };
    }

    // Analyze all children and get max risk
    let maxRisk = 0;
    for (const child of children) {
      const result = await this.analyzeChild(child._id.toString());
      if (result && result.risk > maxRisk) {
        maxRisk = result.risk;
      }
    }

    const segment = this.getSegmentFromRisk(maxRisk) as OfferSegment;

    // ========== LTV ENGINE INTEGRATION ==========
    const ltv = await this.ltvService.get(userId, tenantId);

    // Check if user is worth saving (LTV < 2000 AND riskScore > 80 = don't save)
    if (!this.ltvService.isWorthSaving(ltv, maxRisk)) {
      return { 
        segment, 
        riskScore: maxRisk, 
        action: 'NOT_WORTH_SAVING',
        ltv,
      };
    }

    // Check if user is upsell candidate (HIGH LTV + LOW risk)
    if (this.ltvService.isUpsellCandidate(ltv, maxRisk)) {
      // Create VIP upsell action for coach
      await this.createCoachAction(userId, tenantId, {
        type: 'UPSELL_VIP',
        priority: 'MEDIUM',
        message: `${ltv.segment} LTV клієнт - пропонуйте VIP або персональні тренування`,
      });
      return {
        segment,
        riskScore: maxRisk,
        action: 'UPSELL_VIP',
        ltv,
      };
    }

    // ========== PREDICTIVE ENGINE INTEGRATION ==========
    const prediction = await this.predictiveService.predict(userId, tenantId);

    // Handle predictive actions
    if (prediction.nextBestAction === 'COACH_CALL') {
      await this.createCoachAction(userId, tenantId, {
        type: 'CALL_PARENT',
        priority: 'HIGH',
        message: `Високий ризик відтоку (${Math.round(prediction.churn7d * 100)}%) - зателефонуйте батькам`,
      });
      return {
        segment,
        riskScore: maxRisk,
        action: 'COACH_ACTION',
        ltv,
        prediction,
      };
    }

    if (prediction.nextBestAction === 'COACH_MESSAGE') {
      await this.createCoachAction(userId, tenantId, {
        type: 'MESSAGE_PARENT',
        priority: 'MEDIUM',
        message: `Ризик відтоку (${Math.round(prediction.churn7d * 100)}%) - напишіть батькам`,
      });
    }

    // Check if action needed (discount)
    if (segment !== 'CHURN_RISK' && segment !== 'WARNING') {
      return { segment, riskScore: maxRisk, action: 'NO_ACTION', ltv, prediction };
    }

    // ========== DYNAMIC PRICING ==========
    // Get dynamic discount based on LTV segment
    const dynamicDiscount = this.ltvService.getDynamicDiscount(ltv);

    // Pick offer from Growth Engine (for title/description)
    const offer = await this.growthEngine.pickOffer(tenantId, segment);

    // Track view
    const offerId = offer ? (offer as any)._id : null;
    if (offerId && typeof offerId === 'string' && !offerId.startsWith('default_')) {
      await this.growthEngine.trackView(offerId);
    }

    // Create discount with LTV-based dynamic value
    const discount = await this.discountsService.createMetaDiscountSafe({
      tenantId,
      userId,
      value: dynamicDiscount, // LTV-based discount instead of fixed
      reason: `LTV:${ltv.segment} | Risk:${maxRisk} | Predictive:${prediction.nextBestAction}`,
      title: offer?.title || 'Спеціальна пропозиція',
      description: offer?.description || 'Поверніться до занять зі знижкою',
      ttlHours: offer?.ttlHours || 48,
      offerId: offerId?.toString(),
    });

    // Check if discount was newly created
    const discountAny = discount as any;
    const isNew = discountAny.createdAt && 
      (new Date().getTime() - new Date(discountAny.createdAt).getTime()) < 1000;

    return {
      segment,
      riskScore: maxRisk,
      action: isNew ? 'DISCOUNT_CREATED' : 'DISCOUNT_EXISTS',
      discount: {
        id: discount._id,
        value: discount.value,
        expiresAt: discount.expiresAt,
        reason: discount.reason,
      },
      ltv,
      prediction,
    };
  }

  /**
   * Helper to create coach actions
   */
  private async createCoachAction(userId: string, tenantId: string, action: {
    type: string;
    priority: string;
    message: string;
  }) {
    const children = await this.childModel.find({ parentId: userId });
    if (children.length === 0) return;

    const child = children[0];
    const parent = await this.userModel.findById(userId);

    // Create action for coach
    await this.coachActionModel.create({
      tenantId,
      coachId: child.coachId,
      childId: child._id.toString(),
      childName: `${child.firstName} ${child.lastName || ''}`.trim(),
      parentId: userId,
      parentName: parent ? `${parent.firstName} ${parent.lastName || ''}`.trim() : '',
      parentPhone: parent?.phone,
      type: action.type,
      priority: action.priority,
      title: action.type,
      message: action.message,
      status: 'PENDING',
    });
  }

  /**
   * Run MetaBrain for all parents (called by CRON)
   */
  async runForAllUsers(tenantId: string = 'default'): Promise<{
    processed: number;
    discountsCreated: number;
    errors: number;
  }> {
    const parents = await this.userModel.find({ role: 'PARENT', tenantId });
    
    let processed = 0;
    let discountsCreated = 0;
    let errors = 0;

    for (const parent of parents) {
      try {
        const result = await this.evaluateUser(parent._id.toString(), tenantId);
        processed++;
        if (result.action === 'DISCOUNT_CREATED') {
          discountsCreated++;
        }
      } catch (e) {
        errors++;
      }
    }

    return { processed, discountsCreated, errors };
  }
}
