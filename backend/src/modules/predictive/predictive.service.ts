import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';

export type NextBestAction = 
  | 'NO_ACTION'
  | 'SEND_PUSH'
  | 'PAYMENT_REMINDER'
  | 'RETENTION_DISCOUNT'
  | 'COACH_MESSAGE'
  | 'COACH_CALL'
  | 'UPSELL_VIP'
  | 'BOOK_PERSONAL'
  | 'COMPETITION_INVITE';

export interface PredictionProfile {
  userId: string;
  tenantId: string;
  churn7d: number;          // 0..1
  churn14d: number;
  churn30d: number;
  paymentRisk: number;      // 0..1
  upsellProbability: number;
  returnProbability: number;
  nextBestAction: NextBestAction;
  recommendedOffer: number; // discount percentage
  updatedAt: Date;
}

export interface FeatureSet {
  attendanceRate: number;
  missedInRow: number;
  noVisitDays: number;
  paymentOverdueDays: number;
  competitionsCount: number;
  medalsCount: number;
  bookingPersonalCount: number;
  monthsActive: number;
  tier: string;
  ltvSegment: string;
}

@Injectable()
export class PredictiveService {
  private readonly logger = new Logger('PredictiveService');

  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  /**
   * Build feature set for prediction
   */
  async buildFeatures(userId: string): Promise<FeatureSet> {
    const children = await this.childModel.find({ parentId: userId });
    const childIds = children.map(c => c._id.toString());

    // Attendance stats
    const attendance = await this.attendanceModel.find({
      childId: { $in: childIds },
    }).sort({ date: -1 }).limit(30);

    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = attendance.length > 0 ? presentCount / attendance.length : 0.8;

    // Missed in row
    let missedInRow = 0;
    for (const a of attendance) {
      if (a.status !== 'PRESENT') missedInRow++;
      else break;
    }

    // Last visit days
    let noVisitDays = 0;
    const lastPresent = attendance.find(a => a.status === 'PRESENT');
    if (lastPresent?.date) {
      const lastDate = new Date(lastPresent.date);
      noVisitDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Payment stats
    const pendingPayments = await this.paymentModel.find({
      childId: { $in: childIds },
      status: { $in: ['PENDING', 'OVERDUE'] },
    });

    let paymentOverdueDays = 0;
    for (const p of pendingPayments) {
      if (p.dueDate) {
        const days = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (days > paymentOverdueDays) paymentOverdueDays = days;
      }
    }

    // Count medals and competitions (from children)
    const medalsCount = children.reduce((sum, c) => 
      sum + (c.goldMedals || 0) + (c.silverMedals || 0) + (c.bronzeMedals || 0), 0);
    
    const competitionsCount = children.reduce((sum, c) => 
      sum + (c.tournamentPoints ? 1 : 0), 0);

    return {
      attendanceRate,
      missedInRow,
      noVisitDays,
      paymentOverdueDays: Math.max(0, paymentOverdueDays),
      competitionsCount,
      medalsCount,
      bookingPersonalCount: 0, // TODO: implement booking count
      monthsActive: 6, // TODO: calculate from user createdAt
      tier: 'PRO',
      ltvSegment: 'MID',
    };
  }

  /**
   * Predict churn and actions
   */
  async predict(userId: string, tenantId: string = 'default'): Promise<PredictionProfile> {
    const f = await this.buildFeatures(userId);

    // Churn probability (7 days)
    const churn7d = this.clamp(
      (1 - f.attendanceRate) * 0.35 +
      (f.missedInRow / 5) * 0.25 +
      (f.noVisitDays / 14) * 0.20 +
      (f.paymentOverdueDays / 10) * 0.20
    );

    // Payment risk
    const paymentRisk = this.clamp(
      (f.paymentOverdueDays / 10) * 0.5 +
      (1 - f.attendanceRate) * 0.3 +
      (f.noVisitDays / 14) * 0.2
    );

    // Upsell probability (high engagement = upsell candidate)
    const upsellProbability = this.clamp(
      f.attendanceRate * 0.35 +
      (f.bookingPersonalCount / 5) * 0.25 +
      (f.competitionsCount / 5) * 0.20 +
      (f.monthsActive / 12) * 0.20
    );

    // Return probability (inverse of no-visit and payment issues)
    const returnProbability = this.clamp(
      (1 - f.noVisitDays / 30) * 0.4 +
      (1 - f.paymentOverdueDays / 10) * 0.3 +
      f.attendanceRate * 0.3
    );

    // Decide next best action
    const nextBestAction = this.decideAction({
      churn7d,
      paymentRisk,
      upsellProbability,
      returnProbability,
    });

    // Decide recommended offer
    const recommendedOffer = this.decideOffer({ churn7d, paymentRisk });

    return {
      userId,
      tenantId,
      churn7d,
      churn14d: this.clamp(churn7d + 0.1),
      churn30d: this.clamp(churn7d + 0.2),
      paymentRisk,
      upsellProbability,
      returnProbability,
      nextBestAction,
      recommendedOffer,
      updatedAt: new Date(),
    };
  }

  private clamp(v: number): number {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return Number(v.toFixed(2));
  }

  private decideAction(ctx: {
    churn7d: number;
    paymentRisk: number;
    upsellProbability: number;
    returnProbability: number;
  }): NextBestAction {
    // Priority order of actions
    if (ctx.paymentRisk > 0.7) return 'PAYMENT_REMINDER';
    if (ctx.churn7d > 0.7) return 'RETENTION_DISCOUNT';
    if (ctx.upsellProbability > 0.75) return 'UPSELL_VIP';
    if (ctx.returnProbability < 0.35) return 'COACH_CALL';
    if (ctx.churn7d > 0.5) return 'COACH_MESSAGE';
    if (ctx.churn7d > 0.3) return 'SEND_PUSH';
    return 'NO_ACTION';
  }

  private decideOffer(ctx: { churn7d: number; paymentRisk: number }): number {
    if (ctx.churn7d > 0.8) return 35;  // Aggressive retention
    if (ctx.churn7d > 0.6) return 20;  // Standard retention
    if (ctx.paymentRisk > 0.7) return 10; // Payment help
    return 0; // No offer needed
  }

  /**
   * Get aggregated predictions for admin dashboard
   */
  async getAdminPredictions(tenantId: string = 'default'): Promise<{
    churn7dCount: number;
    paymentRiskCount: number;
    upsellCandidates: number;
    avgChurn7d: number;
    avgPaymentRisk: number;
    predictions: PredictionProfile[];
  }> {
    // For now, mock aggregated data
    // In production, this would query cached predictions
    return {
      churn7dCount: 12,
      paymentRiskCount: 8,
      upsellCandidates: 5,
      avgChurn7d: 0.34,
      avgPaymentRisk: 0.21,
      predictions: [],
    };
  }
}
