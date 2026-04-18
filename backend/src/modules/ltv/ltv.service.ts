import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';

export interface LtvProfile {
  userId: string;
  tenantId: string;
  arpu: number;           // Average revenue per user (грн/місяць)
  churnProbability: number; // 0..1
  expectedMonths: number;   // очікувані місяці
  ltv: number;              // Lifetime Value (грн)
  segment: 'LOW' | 'MID' | 'HIGH';
  updatedAt: Date;
}

@Injectable()
export class LtvService {
  private readonly logger = new Logger('LtvService');

  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  /**
   * Calculate LTV for a user
   */
  async calculate(userId: string, tenantId: string = 'default'): Promise<LtvProfile> {
    // Get user's children
    const children = await this.childModel.find({ parentId: userId });
    const childIds = children.map(c => c._id.toString());

    // Get payment history (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await this.paymentModel.find({
      childId: { $in: childIds },
      status: 'PAID',
      paidAt: { $gte: sixMonthsAgo },
    });

    // Calculate ARPU (average monthly spend)
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const arpu = payments.length > 0 ? Math.round(totalPaid / 6) : 2000; // default 2000

    // Calculate churn probability based on attendance
    const attendance = await this.attendanceModel.find({
      childId: { $in: childIds },
    }).sort({ date: -1 }).limit(30);

    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = attendance.length > 0 ? presentCount / attendance.length : 0.8;

    // Simple churn proxy
    const churnProbability = Math.max(0, Math.min(1, 1 - attendanceRate));

    // Expected months (inverse of churn)
    const expectedMonths = Math.max(1, Math.round(12 * (1 - churnProbability)));

    // LTV calculation
    const ltv = arpu * expectedMonths;

    // Segment based on LTV
    const segment: 'LOW' | 'MID' | 'HIGH' = 
      ltv > 20000 ? 'HIGH' :
      ltv > 8000 ? 'MID' : 'LOW';

    return {
      userId,
      tenantId,
      arpu,
      churnProbability: Number(churnProbability.toFixed(2)),
      expectedMonths,
      ltv,
      segment,
      updatedAt: new Date(),
    };
  }

  /**
   * Get cached or calculate LTV
   */
  async get(userId: string, tenantId: string = 'default'): Promise<LtvProfile> {
    // For now, always calculate fresh (can add caching later)
    return this.calculate(userId, tenantId);
  }

  /**
   * Get dynamic discount based on LTV segment
   * HIGH LTV → 10% (don't need big discount)
   * MID LTV → 20%
   * LOW LTV → 35% (need aggressive retention)
   */
  getDynamicDiscount(ltv: LtvProfile): number {
    if (ltv.segment === 'HIGH') return 10;
    if (ltv.segment === 'MID') return 20;
    return 35; // LOW
  }

  /**
   * Check if user is worth saving
   * Don't waste resources on very low LTV + high churn users
   */
  isWorthSaving(ltv: LtvProfile, riskScore: number): boolean {
    // Not worth saving: low LTV AND high risk
    if (ltv.ltv < 2000 && riskScore > 80) {
      return false;
    }
    return true;
  }

  /**
   * Check if user is ready for VIP upsell
   */
  isUpsellCandidate(ltv: LtvProfile, riskScore: number): boolean {
    // HIGH LTV and LOW risk = upsell candidate
    return ltv.segment === 'HIGH' && riskScore < 30;
  }
}
