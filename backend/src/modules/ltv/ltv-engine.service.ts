import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { StudentLtv, StudentLtvDocument } from '../../schemas/student-ltv.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';

/**
 * LTV ENGINE - Lifetime Value Calculations
 * 
 * Формули:
 * - LTV_actual = totalPaid - totalDiscounts
 * - LTV_predicted = avgMonthlyPayment * predictedMonthsLeft
 * - predictedMonthsLeft = (100 - riskScore) / 10
 * 
 * Приклад:
 * - risk = 80 → осталось ~2 місяці
 * - risk = 30 → осталось ~7 місяців
 */
@Injectable()
export class LtvEngineService {
  private readonly logger = new Logger('LtvEngineService');

  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(StudentLtv.name) private ltvModel: Model<StudentLtvDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  /**
   * Calculate Student Risk Score
   * Used for LTV prediction
   */
  async calculateRiskScore(childId: string): Promise<number> {
    const child = await this.childModel.findById(childId);
    if (!child) return 50;

    // Get attendance data
    const attendance = await this.attendanceModel
      .find({ childId })
      .sort({ date: -1 })
      .limit(30);

    const totalTrainings = attendance.length;
    const attendedTrainings = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = totalTrainings > 0 ? (attendedTrainings / totalTrainings) * 100 : 100;

    // Get last visit
    const lastPresent = attendance.find(a => a.status === 'PRESENT');
    let lastVisitDays = 0;
    if (lastPresent) {
      const lastDate = new Date(lastPresent.date);
      lastVisitDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get debt
    const invoices = await this.invoiceModel.find({ childId, status: { $ne: 'PAID' } });
    const hasDebt = invoices.length > 0;

    // Count missed in row
    let missedInRow = 0;
    for (const a of attendance) {
      if (a.status !== 'PRESENT') missedInRow++;
      else break;
    }

    // Calculate risk score
    let riskScore = 0;
    if (attendanceRate < 40) riskScore += 40;
    else if (attendanceRate < 60) riskScore += 25;
    else if (attendanceRate < 80) riskScore += 10;

    if (lastVisitDays > 14) riskScore += 25;
    else if (lastVisitDays > 7) riskScore += 15;
    else if (lastVisitDays > 5) riskScore += 10;

    if (hasDebt) riskScore += 25;
    if (missedInRow >= 3) riskScore += 10;

    return Math.min(100, riskScore);
  }

  /**
   * Calculate and Update Student LTV
   */
  async calculateStudentLtv(childId: string): Promise<StudentLtvDocument> {
    // Get all paid payments
    const payments = await this.paymentModel.find({ 
      childId,
      status: 'COMPLETED',
    });

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Get discounts (from invoices)
    const invoices = await this.invoiceModel.find({ childId });
    const totalDiscounts = invoices.reduce((sum, inv) => sum + ((inv as any).discountAmount || 0), 0);

    // Calculate months active
    const firstPayment = payments.sort((a, b) => 
      new Date((a as any).createdAt).getTime() - new Date((b as any).createdAt).getTime()
    )[0];
    
    let monthsActive = 1;
    if (firstPayment) {
      const startDate = new Date((firstPayment as any).createdAt);
      const now = new Date();
      monthsActive = Math.max(1, Math.ceil(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));
    }

    // Calculate average monthly payment
    const avgMonthlyPayment = monthsActive > 0 ? Math.round(totalPaid / monthsActive) : 2000;

    // Calculate risk and predicted months left
    const riskScore = await this.calculateRiskScore(childId);
    const churnProbability = riskScore;
    const predictedMonthsLeft = Math.max(1, Math.round((100 - riskScore) / 10));

    // LTV calculations
    const ltvActual = totalPaid - totalDiscounts;
    const ltvPredicted = avgMonthlyPayment * predictedMonthsLeft;
    const ltvTotal = ltvActual + ltvPredicted;

    // Upsert LTV record
    const ltv = await this.ltvModel.findOneAndUpdate(
      { childId },
      {
        childId,
        totalPaid,
        totalDiscounts,
        monthsActive,
        avgMonthlyPayment,
        churnProbability,
        predictedMonthsLeft,
        ltvActual,
        ltvPredicted,
        ltvTotal,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return ltv;
  }

  /**
   * Get Student LTV Data
   */
  async getStudentLtv(childId: string) {
    let ltv = await this.ltvModel.findOne({ childId });
    
    // Calculate if not exists or outdated (older than 1 day)
    if (!ltv || !ltv.updatedAt || 
        (Date.now() - ltv.updatedAt.getTime()) > 24 * 60 * 60 * 1000) {
      ltv = await this.calculateStudentLtv(childId) as any;
    }

    return {
      totalPaid: ltv.totalPaid,
      totalDiscounts: ltv.totalDiscounts,
      monthsActive: ltv.monthsActive,
      avgMonthlyPayment: ltv.avgMonthlyPayment,
      churnProbability: ltv.churnProbability,
      predictedMonthsLeft: ltv.predictedMonthsLeft,
      ltvActual: ltv.ltvActual,
      ltvPredicted: ltv.ltvPredicted,
      ltvTotal: ltv.ltvTotal,
    };
  }

  /**
   * Calculate Group Revenue Analytics
   */
  async getGroupRevenue(groupId: string) {
    const children = await this.childModel.find({ groupId });
    const childIds = children.map(c => c._id.toString());

    let totalLtvActual = 0;
    let totalLtvPredicted = 0;
    let totalChurnRisk = 0;

    for (const childId of childIds) {
      const ltv = await this.getStudentLtv(childId);
      totalLtvActual += ltv.ltvActual;
      totalLtvPredicted += ltv.ltvPredicted;
      
      // Churn risk = probability * predicted value
      const churnRisk = (ltv.churnProbability / 100) * ltv.ltvPredicted;
      totalChurnRisk += churnRisk;
    }

    // Expected next month (avg monthly * students)
    const avgMonthly = children.length > 0 ? totalLtvActual / (children.length * 6) : 2000;
    const expectedNextMonth = Math.round(avgMonthly * children.length);

    return {
      totalLtvActual,
      totalLtvPredicted,
      totalLtvTotal: totalLtvActual + totalLtvPredicted,
      expectedNextMonth,
      churnRiskAmount: Math.round(totalChurnRisk),
      studentsCount: children.length,
    };
  }

  /**
   * Calculate Coach Revenue Analytics
   */
  async getCoachRevenue(coachId: string) {
    const groups = await this.groupModel.find({ coachId });
    
    let totalLtvActual = 0;
    let totalLtvPredicted = 0;
    let totalChurnRisk = 0;
    let totalStudents = 0;

    for (const group of groups) {
      const groupRevenue = await this.getGroupRevenue(group._id.toString());
      totalLtvActual += groupRevenue.totalLtvActual;
      totalLtvPredicted += groupRevenue.totalLtvPredicted;
      totalChurnRisk += groupRevenue.churnRiskAmount;
      totalStudents += groupRevenue.studentsCount;
    }

    // Monthly forecast
    const avgMonthly = totalStudents > 0 ? totalLtvActual / (totalStudents * 6) : 2000;
    const forecastNextMonth = Math.round(avgMonthly * totalStudents);

    return {
      totalRevenue: totalLtvActual,
      predictedRevenue: totalLtvPredicted,
      totalLtv: totalLtvActual + totalLtvPredicted,
      forecastNextMonth,
      churnRiskAmount: Math.round(totalChurnRisk),
      groupsCount: groups.length,
      studentsCount: totalStudents,
    };
  }

  /**
   * Should Give Discount - Dynamic Pricing Logic
   * 
   * Rule: IF LTV_predicted > discount → allow discount
   */
  shouldGiveDiscount(ltvPredicted: number, discountAmount: number): {
    allowed: boolean;
    reason: string;
    expectedProfit: number;
  } {
    const allowed = ltvPredicted > discountAmount;
    const expectedProfit = ltvPredicted - discountAmount;

    return {
      allowed,
      reason: allowed 
        ? `Знижка вигідна: +${expectedProfit} грн очікуваного прибутку`
        : `Знижка невигідна: втрата ${Math.abs(expectedProfit)} грн`,
      expectedProfit,
    };
  }

  /**
   * Get Discount Recommendation for Student
   */
  async getDiscountRecommendation(childId: string) {
    const ltv = await this.getStudentLtv(childId);
    
    // Calculate optimal discount based on risk
    const maxDiscount = Math.round(ltv.ltvPredicted * 0.3); // Max 30% of predicted LTV
    
    const recommendations = [];

    // 10% discount
    const discount10 = Math.round(ltv.avgMonthlyPayment * 0.1);
    const result10 = this.shouldGiveDiscount(ltv.ltvPredicted, discount10);
    recommendations.push({
      percent: 10,
      amount: discount10,
      ...result10,
    });

    // 15% discount
    const discount15 = Math.round(ltv.avgMonthlyPayment * 0.15);
    const result15 = this.shouldGiveDiscount(ltv.ltvPredicted, discount15);
    recommendations.push({
      percent: 15,
      amount: discount15,
      ...result15,
    });

    // 20% discount
    const discount20 = Math.round(ltv.avgMonthlyPayment * 0.2);
    const result20 = this.shouldGiveDiscount(ltv.ltvPredicted, discount20);
    recommendations.push({
      percent: 20,
      amount: discount20,
      ...result20,
    });

    // 30% discount (max for high risk)
    const discount30 = Math.round(ltv.avgMonthlyPayment * 0.3);
    const result30 = this.shouldGiveDiscount(ltv.ltvPredicted, discount30);
    recommendations.push({
      percent: 30,
      amount: discount30,
      ...result30,
    });

    return {
      ltv,
      maxDiscountAllowed: maxDiscount,
      recommendations,
      bestRecommendation: recommendations.filter(r => r.allowed).pop() || null,
    };
  }
}
