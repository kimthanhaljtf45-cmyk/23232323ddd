import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { CoachAction, CoachActionDocument } from '../../schemas/coach-action.schema';
import { Progress, ProgressDocument } from '../../schemas/progress.schema';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';

export interface StudentBadge {
  type: 'stable' | 'warning' | 'critical' | 'debt' | 'top' | 'new';
  label: string;
  color: string;
}

export interface StudentAnalytics {
  attendanceRate: number;
  lastVisitDays: number;
  riskScore: number;
  riskLevel: 'low' | 'warning' | 'critical';
  debt: number;
  progressScore: number;
  streak: number;
  missedInRow: number;
  totalTrainings: number;
  attendedTrainings: number;
  attendanceHistory: Array<{ date: string; status: 'present' | 'absent' | 'late' }>;
  trend: 'up' | 'down' | 'stable';
  trendReason?: string;
  coachScoreImpact: number;
  badges: StudentBadge[];
}

export interface GroupHealth {
  score: number; // 0-100
  status: 'good' | 'warning' | 'critical';
  attendance: number;
  retention: number;
  churn: number;
  revenue: {
    expected: number;
    received: number;
    debt: number;
    debtorsCount: number;
  };
  capacity: {
    current: number;
    max: number;
    fillRate: number;
    freeSlots: number;
  };
  atRisk: Array<{
    studentId: string;
    studentName: string;
    reason: string;
    daysInactive: number;
    hasDebt: boolean;
  }>;
  dynamics: {
    attendanceTrend: number[]; // Last 4 weeks
    churnTrend: number[];
    revenueTrend: number[];
    trendReason?: string;
  };
  coachScoreImpact: number;
}

export interface CoachKPI {
  coachScore: number;
  breakdown: {
    attendance: number;      // 40%
    retention: number;       // 30%
    results: number;         // 20%
    actions: number;         // 10%
  };
  trend: 'up' | 'down' | 'stable';
  trendChange: number;
  trendReasons: string[];
  level: 'BEGINNER' | 'PRO' | 'TOP' | 'ELITE';
}

@Injectable()
export class CoachAnalyticsService {
  private readonly logger = new Logger(CoachAnalyticsService.name);

  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(CoachAction.name) private coachActionModel: Model<CoachActionDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  /**
   * Calculate Coach KPI Score
   * Formula: 40% attendance + 30% retention + 20% results + 10% actions
   */
  async calculateCoachKPI(coachId: string): Promise<CoachKPI> {
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    // Calculate attendance score (0-100)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const childIds = children.map(c => c._id.toString());
    const attendance = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
    });

    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceScore = attendance.length > 0 
      ? Math.round((presentCount / attendance.length) * 100)
      : 85;

    // Calculate retention score (inverse of churn)
    const atRiskCount = await this.getAtRiskStudentsCount(coachId);
    const totalStudents = children.length || 1;
    const retentionScore = Math.round((1 - atRiskCount / totalStudents) * 100);

    // Results score (medals, competitions)
    // For now, use placeholder - should integrate with competitions service
    const resultsScore = 75;

    // Actions completion rate
    const actions = await this.coachActionModel.find({
      coachId,
      createdAt: { $gte: thirtyDaysAgo },
    } as any);
    const completedActions = actions.filter(a => a.status === 'DONE' || (a as any).completedAt).length;
    const actionsScore = actions.length > 0 
      ? Math.round((completedActions / actions.length) * 100)
      : 80;

    // Calculate weighted score
    const coachScore = Math.round(
      attendanceScore * 0.4 +
      retentionScore * 0.3 +
      resultsScore * 0.2 +
      actionsScore * 0.1
    );

    // Determine level
    const level: CoachKPI['level'] = 
      coachScore >= 90 ? 'ELITE' :
      coachScore >= 80 ? 'TOP' :
      coachScore >= 65 ? 'PRO' : 'BEGINNER';

    // Calculate trend (compare to last week)
    // Simplified - would need historical data
    const trendReasons: string[] = [];
    let trendChange = 0;

    if (atRiskCount > 2) {
      trendReasons.push(`${atRiskCount} учнів у ризику`);
      trendChange -= 5;
    }
    if (attendanceScore < 80) {
      trendReasons.push('Attendance нижче 80%');
      trendChange -= 3;
    }

    const trend: CoachKPI['trend'] = 
      trendChange > 2 ? 'up' : 
      trendChange < -2 ? 'down' : 'stable';

    return {
      coachScore,
      breakdown: {
        attendance: attendanceScore,
        retention: retentionScore,
        results: resultsScore,
        actions: actionsScore,
      },
      trend,
      trendChange,
      trendReasons,
      level,
    };
  }

  /**
   * Get Coach Dashboard Data
   */
  async getCoachDashboard(coachId: string) {
    const coach = await this.userModel.findById(coachId);
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    // Calculate KPI
    const kpi = await this.calculateCoachKPI(coachId);

    // Get today's trainings
    const todayTrainings = await this.getTodayTrainings(coachId);

    // Get at-risk students
    const atRiskStudents = await this.getAtRiskStudents(coachId, 5);

    // Get pending actions
    const actions = await this.getCoachActions(coachId);

    // Critical count
    const criticalCount = atRiskStudents.filter(s => s.riskLevel === 'critical').length;

    // Revenue stats
    const childIds = children.map(c => c._id.toString());
    const invoices = await this.invoiceModel.find({ childId: { $in: childIds } });
    const unpaidInvoices = invoices.filter(i => i.status !== 'PAID');
    const totalDebt = unpaidInvoices.reduce((sum, i) => sum + ((i as any).totalAmount || i.amount || 0), 0);

    // Impact preview (if actions completed)
    const impactPreview = {
      retentionGain: actions.length > 0 ? Math.min(15, actions.length * 3) : 0,
      revenueSaved: totalDebt > 0 ? Math.round(totalDebt * 0.7) : 0,
    };

    // KPI Impact Breakdown — how students and groups affect the score
    const riskStudentsByGroup = new Map<string, number>();
    for (const child of children) {
      const analytics = await this.getStudentAnalytics(child._id.toString());
      if (analytics.riskLevel === 'critical' || analytics.riskLevel === 'warning') {
        const gId = child.groupId || 'unknown';
        riskStudentsByGroup.set(gId, (riskStudentsByGroup.get(gId) || 0) + 1);
      }
    }

    let studentImpact = 0;
    let groupImpact = 0;
    for (const child of children) {
      const analytics = await this.getStudentAnalytics(child._id.toString());
      studentImpact += analytics.coachScoreImpact;
    }

    for (const group of groups) {
      const health = await this.calculateGroupHealth(group._id.toString());
      groupImpact += health.coachScoreImpact;
    }

    const kpiImpact = {
      studentImpact,
      groupImpact,
      total: studentImpact + groupImpact,
      details: `${Math.abs(studentImpact)} через учнів, ${Math.abs(groupImpact)} через групи`,
    };

    return {
      hero: {
        name: coach?.firstName || 'Тренер',
        groupsCount: groups.length,
        studentsCount: children.length,
        criticalCount,
      },
      kpi,
      todayTrainings,
      atRiskStudents,
      actions: actions.slice(0, 5),
      globalActions: {
        riskStudentsCount: atRiskStudents.length,
        debtorsCount: unpaidInvoices.length,
        inactiveCount: children.filter(c => {
          const child = c as any;
          return child.lastVisitDays > 5;
        }).length,
      },
      impactPreview,
      kpiImpact,
    };
  }

  /**
   * Get Group Detail with Health Score
   */
  async getGroupDetail(groupId: string): Promise<{
    group: any;
    health: GroupHealth;
    students: any[];
    schedule: any[];
    trainingHistory: any[];
  }> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new Error('Group not found');

    const children = await this.childModel.find({ groupId });
    const childIds = children.map(c => c._id.toString());

    // Get health score
    const health = await this.calculateGroupHealth(groupId);

    // Get students with analytics
    const students = await Promise.all(
      children.map(async (child) => {
        const analytics = await this.getStudentAnalytics(child._id.toString());
        const parent = child.parentId ? await this.userModel.findById(child.parentId) : null;
        return {
          id: child._id.toString(),
          name: `${child.firstName} ${child.lastName || ''}`.trim(),
          age: child.age,
          belt: child.belt || 'WHITE',
          ...analytics,
          parentPhone: parent?.phone,
        };
      })
    );

    // Get schedule
    const schedules = await this.scheduleModel.find({ groupId, isActive: true });
    const schedule = schedules.map(s => ({
      id: s._id.toString(),
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    // Get training history (last 10)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const attendanceRecords = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
    }).sort({ date: -1 });

    // Group by date
    const dateGroups = new Map<string, { present: number; absent: number }>();
    attendanceRecords.forEach(a => {
      const date = a.date;
      if (!dateGroups.has(date)) {
        dateGroups.set(date, { present: 0, absent: 0 });
      }
      const group = dateGroups.get(date)!;
      if (a.status === 'PRESENT') group.present++;
      else group.absent++;
    });

    const trainingHistory = Array.from(dateGroups.entries())
      .slice(0, 10)
      .map(([date, stats]) => ({
        date,
        attended: stats.present,
        absent: stats.absent,
      }));

    return {
      group: {
        id: group._id.toString(),
        name: group.name,
        ageRange: group.ageRange,
        programType: group.programType,
        coachId: group.coachId,
        maxStudents: group.capacity || 15,
      },
      health,
      students,
      schedule,
      trainingHistory,
    };
  }

  /**
   * Calculate Group Health Score
   */
  async calculateGroupHealth(groupId: string): Promise<GroupHealth> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new Error('Group not found');

    const children = await this.childModel.find({ groupId });
    const childIds = children.map(c => c._id.toString());

    // Attendance calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendance = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
    });

    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = attendance.length > 0 
      ? Math.round((presentCount / attendance.length) * 100)
      : 85;

    // Revenue calculation
    const invoices = await this.invoiceModel.find({ childId: { $in: childIds } });
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyInvoices = invoices.filter(i => {
      const date = new Date((i as any).createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const expectedRevenue = children.length * 2000; // Default program price
    const receivedRevenue = monthlyInvoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + ((i as any).totalAmount || i.amount || 0), 0);
    const debtAmount = monthlyInvoices
      .filter(i => i.status !== 'PAID')
      .reduce((sum, i) => sum + ((i as any).totalAmount || i.amount || 0), 0);
    const debtorsCount = new Set(
      monthlyInvoices.filter(i => i.status !== 'PAID').map(i => i.childId)
    ).size;

    // At-risk students
    const atRisk: GroupHealth['atRisk'] = [];
    for (const child of children) {
      const childAttendance = attendance.filter(a => a.childId === child._id.toString());
      const childPresent = childAttendance.filter(a => a.status === 'PRESENT').length;
      const childRate = childAttendance.length > 0 ? childPresent / childAttendance.length : 1;

      // Find last visit
      const lastPresent = childAttendance.find(a => a.status === 'PRESENT');
      let daysInactive = 0;
      if (lastPresent) {
        const lastDate = new Date(lastPresent.date);
        daysInactive = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Check for debt
      const childDebt = monthlyInvoices
        .filter(i => i.childId === child._id.toString() && i.status !== 'PAID')
        .reduce((sum, i) => sum + ((i as any).totalAmount || i.amount || 0), 0);

      if (childRate < 0.6 || daysInactive > 5 || childDebt > 0) {
        const reasons: string[] = [];
        if (daysInactive > 5) reasons.push(`${daysInactive} днів не ходить`);
        if (childRate < 0.6) reasons.push(`attendance ${Math.round(childRate * 100)}%`);
        if (childDebt > 0) reasons.push('борг');

        atRisk.push({
          studentId: child._id.toString(),
          studentName: `${child.firstName} ${child.lastName || ''}`.trim(),
          reason: reasons.join(' + '),
          daysInactive,
          hasDebt: childDebt > 0,
        });
      }
    }

    // Churn calculation (at-risk / total)
    const churnRate = children.length > 0 
      ? Math.round((atRisk.length / children.length) * 100)
      : 0;

    // Retention = 100 - churn
    const retentionRate = 100 - churnRate;

    // Capacity
    const maxStudents = group.capacity || 15;
    const currentStudents = children.length;
    const fillRate = Math.round((currentStudents / maxStudents) * 100);

    // Calculate Group Health Score
    // Weighted: 40% attendance + 30% retention + 20% revenue + 10% capacity
    const revenueRate = expectedRevenue > 0 
      ? Math.round((receivedRevenue / expectedRevenue) * 100)
      : 100;

    const healthScore = Math.round(
      attendanceRate * 0.4 +
      retentionRate * 0.3 +
      Math.min(100, revenueRate) * 0.2 +
      Math.min(100, fillRate) * 0.1
    );

    // Status based on score
    const status: GroupHealth['status'] = 
      healthScore >= 70 ? 'good' :
      healthScore >= 40 ? 'warning' : 'critical';

    // Dynamics (placeholder - would need historical data)
    const dynamics: GroupHealth['dynamics'] = {
      attendanceTrend: [92, 90, 88, attendanceRate],
      churnTrend: [5, 6, 7, churnRate],
      revenueTrend: [100, 95, 90, revenueRate],
      trendReason: atRisk.length > 2 
        ? `Attendance ↓ через ${atRisk.length} учнів у ризику`
        : undefined,
    };

    // Coach score impact (how much this group affects coach score)
    const coachScoreImpact = healthScore < 70 ? Math.round((70 - healthScore) * 0.1) * -1 : 0;

    return {
      score: healthScore,
      status,
      attendance: attendanceRate,
      retention: retentionRate,
      churn: churnRate,
      revenue: {
        expected: expectedRevenue,
        received: receivedRevenue,
        debt: debtAmount,
        debtorsCount,
      },
      capacity: {
        current: currentStudents,
        max: maxStudents,
        fillRate,
        freeSlots: maxStudents - currentStudents,
      },
      atRisk,
      dynamics,
      coachScoreImpact,
    };
  }

  /**
   * Get Student Detail with Analytics
   */
  async getStudentDetail(studentId: string) {
    const child = await this.childModel.findById(studentId);
    if (!child) throw new Error('Student not found');

    const parent = child.parentId ? await this.userModel.findById(child.parentId) : null;
    const group = child.groupId ? await this.groupModel.findById(child.groupId) : null;
    const progress = await this.progressModel.findOne({ childId: studentId });

    // Get analytics
    const analytics = await this.getStudentAnalytics(studentId);

    // Get action history for this student
    const actionHistory = await this.getStudentActionHistory(studentId);

    // Get MetaBrain recommendation
    const recommendation = this.generateRecommendation(analytics);

    return {
      student: {
        id: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        age: child.age,
        belt: child.belt || 'WHITE',
        groupId: child.groupId,
        groupName: group?.name,
        clubName: 'АТАКА',
      },
      parent: parent ? {
        id: parent._id.toString(),
        name: `${parent.firstName} ${parent.lastName || ''}`.trim(),
        phone: parent.phone,
      } : null,
      progress: progress ? {
        currentBelt: progress.currentBelt,
        nextBelt: progress.nextBelt,
        progressPercent: progress.progressPercent,
        lastExamDate: (progress as any).lastExamDate,
        totalMedals: (progress as any).totalMedals || 0,
        achievements: (progress as any).achievements || [],
      } : null,
      analytics,
      actionHistory,
      recommendation,
    };
  }

  /**
   * Get Student Analytics
   */
  async getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
    const child = await this.childModel.findById(studentId);
    if (!child) throw new Error('Student not found');

    // Get attendance records
    const attendance = await this.attendanceModel
      .find({ childId: studentId })
      .sort({ date: -1 })
      .limit(30);

    const totalTrainings = attendance.length;
    const attendedTrainings = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = totalTrainings > 0 
      ? Math.round((attendedTrainings / totalTrainings) * 100)
      : 100;

    // Calculate streak and missed in row
    let streak = 0;
    let missedInRow = 0;
    let countingStreak = true;

    for (const a of attendance) {
      if (a.status === 'PRESENT') {
        if (countingStreak) streak++;
        if (missedInRow === 0) {
          missedInRow = 0;
        }
      } else {
        if (streak === 0) {
          missedInRow++;
        }
        countingStreak = false;
      }
    }

    // Last visit days
    const lastPresent = attendance.find(a => a.status === 'PRESENT');
    let lastVisitDays = 0;
    if (lastPresent) {
      const lastDate = new Date(lastPresent.date);
      lastVisitDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Debt calculation
    const invoices = await this.invoiceModel.find({ childId: studentId, status: { $ne: 'PAID' } });
    const debt = invoices.reduce((sum, i) => sum + ((i as any).totalAmount || i.amount || 0), 0);

    // Progress score
    const progress = await this.progressModel.findOne({ childId: studentId });
    const progressScore = progress?.progressPercent || 0;

    // Calculate risk score
    let riskScore = 0;
    if (attendanceRate < 40) riskScore += 40;
    else if (attendanceRate < 60) riskScore += 25;
    else if (attendanceRate < 80) riskScore += 10;

    if (lastVisitDays > 14) riskScore += 25;
    else if (lastVisitDays > 7) riskScore += 15;
    else if (lastVisitDays > 5) riskScore += 10;

    if (debt > 0) riskScore += 25;
    if (missedInRow >= 3) riskScore += 10;

    riskScore = Math.min(100, riskScore);

    const riskLevel: StudentAnalytics['riskLevel'] = 
      riskScore >= 70 ? 'critical' :
      riskScore >= 40 ? 'warning' : 'low';

    // Attendance history (last 10)
    const attendanceHistory = attendance.slice(0, 10).map(a => ({
      date: a.date,
      status: a.status === 'PRESENT' ? 'present' as const : 
              a.status === 'LATE' ? 'late' as const : 'absent' as const,
    }));

    // Calculate trend
    const last5Rate = attendance.slice(0, 5).filter(a => a.status === 'PRESENT').length / 5;
    const prev5Rate = attendance.slice(5, 10).filter(a => a.status === 'PRESENT').length / 5;
    
    let trend: StudentAnalytics['trend'] = 'stable';
    let trendReason: string | undefined;
    
    if (last5Rate > prev5Rate + 0.1) {
      trend = 'up';
    } else if (last5Rate < prev5Rate - 0.1) {
      trend = 'down';
      trendReason = `↓ падає через ${missedInRow > 0 ? `${missedInRow} пропусків підряд` : 'низьку відвідуваність'}`;
    }

    // Coach score impact
    const coachScoreImpact = riskLevel === 'critical' ? -2 : riskLevel === 'warning' ? -1 : 0;

    // Generate badges
    const badges: StudentBadge[] = [];
    if (riskLevel === 'critical') {
      badges.push({ type: 'critical', label: 'Критичний', color: '#EF4444' });
    } else if (riskLevel === 'warning') {
      badges.push({ type: 'warning', label: 'Ризик', color: '#F59E0B' });
    } else if (attendanceRate >= 90 && streak >= 5) {
      badges.push({ type: 'top', label: 'Топ', color: '#22C55E' });
    } else {
      badges.push({ type: 'stable', label: 'Стабільний', color: '#22C55E' });
    }

    if (debt > 0) {
      badges.push({ type: 'debt', label: 'Борг', color: '#EF4444' });
    }

    return {
      attendanceRate,
      lastVisitDays,
      riskScore,
      riskLevel,
      debt,
      progressScore,
      streak,
      missedInRow,
      totalTrainings,
      attendedTrainings,
      attendanceHistory,
      trend,
      trendReason,
      coachScoreImpact,
      badges,
    };
  }

  /**
   * Get Coach Actions
   */
  async getCoachActions(coachId: string) {
    const actions = await this.coachActionModel
      .find({ coachId, status: { $ne: 'COMPLETED' } })
      .sort({ priority: 1, createdAt: 1 })
      .limit(20);

    return actions.map(a => ({
      id: a._id.toString(),
      type: a.type,
      title: a.title || (a as any).childName,
      subtitle: a.message,
      childId: a.childId,
      parentId: a.parentId,
      parentPhone: (a as any).parentPhone,
      priority: a.severity || 'warning',
      status: a.status,
      createdAt: (a as any).createdAt,
    }));
  }

  /**
   * Complete an action
   */
  async completeAction(actionId: string) {
    return this.coachActionModel.findByIdAndUpdate(
      actionId,
      { status: 'COMPLETED', completedAt: new Date() },
      { new: true },
    );
  }

  /**
   * Snooze an action
   */
  async snoozeAction(actionId: string, hours: number) {
    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + hours);
    
    return this.coachActionModel.findByIdAndUpdate(
      actionId,
      { status: 'SNOOZED', snoozeUntil },
      { new: true },
    );
  }

  /**
   * Get message template for action type
   */
  getMessageTemplate(actionType: string, studentName?: string) {
    const name = studentName || 'дитина';
    
    const templates: Record<string, string> = {
      LOW_ATTENDANCE: `Доброго дня! Підкажіть, будь ласка, чи зможе ${name} відновити відвідування цього тижня?`,
      PAYMENT_OVERDUE: `Доброго дня! Нагадуємо про оплату занять. Якщо є питання — підкажу.`,
      COMPETITION_CONFIRMATION: `Доброго дня! Потрібно підтвердити участь у змаганнях. Чекаю на вашу відповідь.`,
      ABSENCE_STREAK: `Доброго дня! Помітив, що ${name} пропустив(ла) кілька тренувань. Чи все гаразд?`,
      PROGRESS_STAGNATION: `Доброго дня! Хочу обговорити прогрес ${name} та як ми можемо покращити результати.`,
      BELT_READY: `Доброго дня! Радий повідомити, що ${name} готова до атестації на новий пояс!`,
      DEFAULT: `Доброго дня! Хотів поговорити про ${name}. Зв'яжіться зі мною, будь ласка.`,
    };

    return {
      template: templates[actionType] || templates.DEFAULT,
    };
  }

  /**
   * Send bulk message (placeholder - integrate with messaging service)
   */
  async sendBulkMessage(coachId: string, studentIds: string[], message: string) {
    // This would integrate with the messaging service
    // For now, just log and return success
    this.logger.log(`Bulk message from coach ${coachId} to ${studentIds.length} students`);
    
    return {
      success: true,
      sentTo: studentIds.length,
      message: 'Повідомлення надіслано',
    };
  }

  // Helper methods

  private async getAtRiskStudentsCount(coachId: string): Promise<number> {
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    let count = 0;
    for (const child of children) {
      const analytics = await this.getStudentAnalytics(child._id.toString());
      if (analytics.riskLevel === 'critical' || analytics.riskLevel === 'warning') {
        count++;
      }
    }
    return count;
  }

  private async getAtRiskStudents(coachId: string, limit: number = 10) {
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    const students: any[] = [];
    for (const child of children) {
      const analytics = await this.getStudentAnalytics(child._id.toString());
      if (analytics.riskLevel === 'critical' || analytics.riskLevel === 'warning') {
        const group = groups.find(g => g._id.toString() === child.groupId);
        students.push({
          id: child._id.toString(),
          name: `${child.firstName} ${child.lastName || ''}`.trim(),
          reason: analytics.trendReason || 
            (analytics.lastVisitDays > 5 ? `Не відвідує ${analytics.lastVisitDays} днів` :
             analytics.debt > 0 ? `Борг ${analytics.debt} грн` :
             `Attendance ${analytics.attendanceRate}%`),
          daysInactive: analytics.lastVisitDays,
          groupName: group?.name,
          riskLevel: analytics.riskLevel,
          riskScore: analytics.riskScore,
        });
      }
    }

    return students
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  private async getTodayTrainings(coachId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    const dateStr = today.toISOString().split('T')[0];

    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());

    const schedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      dayOfWeek,
      isActive: true,
    });

    const result = [];
    for (const schedule of schedules) {
      const group = groups.find(g => g._id.toString() === schedule.groupId);
      const children = await this.childModel.find({ groupId: schedule.groupId });
      
      const attendance = await this.attendanceModel.find({
        scheduleId: schedule._id.toString(),
        date: dateStr,
      });

      const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
      const absentCount = attendance.filter(a => a.status !== 'PRESENT').length;

      const now = new Date();
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);
      
      const startTime = new Date(now);
      startTime.setHours(startHour, startMin, 0);
      
      const endTime = new Date(now);
      endTime.setHours(endHour, endMin, 0);

      let status: 'completed' | 'upcoming' | 'in_progress' = 'upcoming';
      if (now > endTime) status = 'completed';
      else if (now >= startTime && now <= endTime) status = 'in_progress';

      result.push({
        id: schedule._id.toString(),
        time: schedule.startTime,
        groupName: group?.name,
        groupId: schedule.groupId,
        present: presentCount,
        absent: absentCount,
        total: children.length,
        status,
      });
    }

    return result;
  }

  async getCoachGroups(coachId: string) {
    const groups = await this.groupModel.find({ coachId });
    
    const result = await Promise.all(
      groups.map(async (group) => {
        const health = await this.calculateGroupHealth(group._id.toString());
        const children = await this.childModel.find({ groupId: group._id.toString() });
        
        return {
          id: group._id.toString(),
          name: group.name,
          ageRange: group.ageRange,
          studentsCount: children.length,
        maxStudents: group.capacity || 15,
          healthScore: health.score,
          healthStatus: health.status,
          attendance: health.attendance,
          debt: health.revenue.debt,
          atRiskCount: health.atRisk.length,
        };
      })
    );

    return result;
  }

  async getCoachStudents(coachId: string) {
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    const result = await Promise.all(
      children.map(async (child) => {
        const analytics = await this.getStudentAnalytics(child._id.toString());
        const group = groups.find(g => g._id.toString() === child.groupId);
        
        return {
          id: child._id.toString(),
          name: `${child.firstName} ${child.lastName || ''}`.trim(),
          age: child.age,
          belt: child.belt || 'WHITE',
          groupName: group?.name,
          attendanceRate: analytics.attendanceRate,
          riskLevel: analytics.riskLevel,
          riskScore: analytics.riskScore,
          debt: analytics.debt,
          lastVisitDays: analytics.lastVisitDays,
          badges: analytics.badges,
        };
      })
    );

    return result.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get Coach Profile (dedicated endpoint)
   */
  async getCoachProfile(coachId: string) {
    const coach = await this.userModel.findById(coachId);
    if (!coach) throw new Error('Coach not found');

    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    // Calculate KPI
    const kpi = await this.calculateCoachKPI(coachId);

    // Get groups summary
    const groupsSummary = await Promise.all(
      groups.map(async (group) => {
        const health = await this.calculateGroupHealth(group._id.toString());
        const studentsInGroup = children.filter(c => c.groupId === group._id.toString());
        return {
          id: group._id.toString(),
          name: group.name,
          ageRange: group.ageRange,
          studentsCount: studentsInGroup.length,
          healthScore: health.score,
          healthStatus: health.status,
        };
      })
    );

    // Training history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const childIds = children.map(c => c._id.toString());
    
    const attendanceRecords = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
    }).sort({ date: -1 });

    // Group by date for training sessions
    const dateGroups = new Map<string, { present: number; absent: number; total: number }>();
    attendanceRecords.forEach(a => {
      const date = a.date;
      if (!dateGroups.has(date)) {
        dateGroups.set(date, { present: 0, absent: 0, total: 0 });
      }
      const group = dateGroups.get(date)!;
      group.total++;
      if (a.status === 'PRESENT') group.present++;
      else group.absent++;
    });

    const trainingHistory = Array.from(dateGroups.entries())
      .slice(0, 20)
      .map(([date, stats]) => ({
        date,
        attended: stats.present,
        absent: stats.absent,
        total: stats.total,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      }));

    // Completed actions count
    const completedActions = await this.coachActionModel.countDocuments({
      coachId,
      status: 'DONE',
    });

    const totalActions = await this.coachActionModel.countDocuments({ coachId });

    // KPI dynamics (simulated weekly data)
    const kpiDynamics = [
      { week: '4 тижні тому', score: Math.max(60, kpi.coachScore - 8) },
      { week: '3 тижні тому', score: Math.max(60, kpi.coachScore - 5) },
      { week: '2 тижні тому', score: Math.max(60, kpi.coachScore - 2) },
      { week: 'Цей тиждень', score: kpi.coachScore },
    ];

    return {
      id: coachId,
      firstName: coach.firstName || 'Тренер',
      lastName: coach.lastName || '',
      phone: coach.phone,
      role: 'Тренер',
      avatarUrl: coach.avatarUrl || null,
      specialization: (coach as any).specialization || ['Бокс', 'Самооборона'],
      experience: (coach as any).experience || '—',
      kpi,
      kpiDynamics,
      stats: {
        groupsCount: groups.length,
        studentsCount: children.length,
        trainingsThisMonth: trainingHistory.length,
        actionsCompleted: completedActions,
        actionsTotal: totalActions,
      },
      groups: groupsSummary,
      trainingHistory,
    };
  }

  /**
   * Get Student Action History
   */
  async getStudentActionHistory(studentId: string) {
    const actions = await this.coachActionModel
      .find({ childId: studentId })
      .sort({ createdAt: -1 })
      .limit(20);

    return actions.map(a => ({
      id: a._id.toString(),
      type: a.type,
      title: a.title,
      message: a.message,
      status: a.status,
      severity: a.severity,
      completedAt: a.completedAt,
      createdAt: (a as any).createdAt,
    }));
  }

  async getStudentFinance(studentId: string) {
    const child = await this.childModel.findById(studentId).lean();
    if (!child) return { error: 'Student not found' };

    const subscription = await this.subscriptionModel.findOne({
      $or: [
        { studentId },
        { childId: studentId },
      ],
      status: { $in: ['ACTIVE', 'RENEWAL_SOON', 'PAUSED'] },
    }).lean();

    return {
      studentId: child._id.toString(),
      name: `${child.firstName} ${child.lastName || ''}`.trim(),
      hasDebt: (child as any).hasDebt || false,
      debtAmount: (child as any).debtAmount || 0,
      subscriptionStatus: subscription?.status || null,
      subscriptionEndsAt: subscription?.endDate || (subscription as any)?.endsAt || null,
    };
  }

  private generateRecommendation(analytics: StudentAnalytics): {
    title: string;
    description: string;
    actions: string[];
  } | null {
    if (analytics.riskLevel === 'critical') {
      return {
        title: '🚨 Високий ризик відтоку',
        description: `Рекомендуємо терміново зв'язатися з батьками та запропонувати персональне тренування або знижку.`,
        actions: [
          'Зателефонувати батькам',
          'Запропонувати знижку -30%',
          'Призначити персональне тренування',
        ],
      };
    }

    if (analytics.riskLevel === 'warning') {
      return {
        title: '⚠️ Потребує уваги',
        description: `Учень показує ознаки зниження активності. Варто зв'язатися з батьками.`,
        actions: [
          'Написати батькам',
          'Запропонувати знижку -15%',
        ],
      };
    }

    if (analytics.attendanceRate >= 90 && analytics.streak >= 5) {
      return {
        title: '🌟 Відмінний учень',
        description: `Учень демонструє високі результати. Розгляньте для підвищення поясу або участі в змаганнях.`,
        actions: [
          'Запропонувати атестацію',
          'Записати на змагання',
        ],
      };
    }

    return null;
  }

  // =============================
  // LEADERBOARD SYSTEM (PHASE 9)
  // =============================

  /**
   * Get Coach Leaderboard (all coaches ranked by score)
   * 
   * Formula: CoachScore + FillRateBonus
   * - CoachScore = 40% attendance + 30% retention + 20% results + 10% actions
   * - FillRateBonus = (fillRate - 50) * 0.1 (capped at +5)
   */
  async getLeaderboard(currentCoachId?: string): Promise<{
    leaderboard: any[];
    myRank: number | null;
    totalCoaches: number;
    lastUpdated: string;
  }> {
    // Get all coaches
    const coaches = await this.userModel.find({ role: 'COACH', status: 'ACTIVE' });
    
    if (coaches.length === 0) {
      return {
        leaderboard: [],
        myRank: null,
        totalCoaches: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Calculate scores for each coach
    const coachScores: Array<{
      coach: any;
      kpi: CoachKPI;
      groups: any[];
      children: any[];
      fillRate: number;
      finalScore: number;
    }> = [];

    for (const coach of coaches) {
      const groups = await this.groupModel.find({ coachId: coach._id.toString() });
      const groupIds = groups.map(g => g._id.toString());
      const children = await this.childModel.find({ groupId: { $in: groupIds } });
      
      // Calculate KPI
      const kpi = await this.calculateCoachKPI(coach._id.toString());
      
      // Calculate fill rate (capacity utilization)
      let totalCapacity = 0;
      let totalStudents = 0;
      for (const group of groups) {
        totalCapacity += group.capacity || 15;
        totalStudents += children.filter(c => c.groupId === group._id.toString()).length;
      }
      const fillRate = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;
      
      // SAFEGUARD: No bonus for small groups (prevent gaming)
      // IF totalStudents < 5 → bonus = 0
      // Apply fill rate bonus: +1 point for every 10% above 50% (max +5)
      const fillRateBonus = totalStudents < 5 
        ? 0 
        : Math.min(5, Math.max(0, Math.floor((fillRate - 50) / 10)));
      
      // Final score = KPI + bonus
      const finalScore = Math.min(100, kpi.coachScore + fillRateBonus);
      
      coachScores.push({
        coach,
        kpi,
        groups,
        children,
        fillRate,
        finalScore,
      });
    }

    // Sort by final score (descending)
    coachScores.sort((a, b) => b.finalScore - a.finalScore);

    // Build leaderboard
    const leaderboard = coachScores.map((entry, index) => ({
      rank: index + 1,
      coachId: entry.coach._id.toString(),
      name: `${entry.coach.firstName || 'Тренер'} ${entry.coach.lastName || ''}`.trim(),
      score: entry.finalScore,
      level: entry.kpi.level,
      groupsCount: entry.groups.length,
      studentsCount: entry.children.length,
      fillRate: entry.fillRate,
      trend: entry.kpi.trend,
      trendChange: entry.kpi.trendChange,
      // Visual trend indicator: ▲ +2, ▼ -1, — 0
      trendIndicator: entry.kpi.trendChange > 0 
        ? `▲ +${entry.kpi.trendChange}` 
        : entry.kpi.trendChange < 0 
          ? `▼ ${entry.kpi.trendChange}`
          : '—',
      avatar: entry.coach.avatarUrl,
      isCurrentUser: currentCoachId === entry.coach._id.toString(),
    }));

    // Find current user's rank
    const myRank = currentCoachId 
      ? leaderboard.find(e => e.coachId === currentCoachId)?.rank || null
      : null;

    return {
      leaderboard,
      myRank,
      totalCoaches: coaches.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get Coach Rank in Club
   */
  async getCoachRank(coachId: string): Promise<{
    rank: number;
    totalCoaches: number;
    percentile: number;
    score: number;
    level: string;
    nextLevelAt: number | null;
    pointsToNextLevel: number;
  }> {
    const { leaderboard, totalCoaches } = await this.getLeaderboard(coachId);
    
    const myEntry = leaderboard.find(e => e.coachId === coachId);
    
    if (!myEntry) {
      // Coach not found in leaderboard - might be new
      const kpi = await this.calculateCoachKPI(coachId);
      return {
        rank: totalCoaches + 1,
        totalCoaches: totalCoaches + 1,
        percentile: 0,
        score: kpi.coachScore,
        level: kpi.level,
        nextLevelAt: this.getNextLevelThreshold(kpi.level),
        pointsToNextLevel: Math.max(0, this.getNextLevelThreshold(kpi.level) - kpi.coachScore),
      };
    }

    const percentile = Math.round(((totalCoaches - myEntry.rank + 1) / totalCoaches) * 100);
    const nextLevelAt = this.getNextLevelThreshold(myEntry.level);
    const pointsToNextLevel = nextLevelAt ? Math.max(0, nextLevelAt - myEntry.score) : 0;

    return {
      rank: myEntry.rank,
      totalCoaches,
      percentile,
      score: myEntry.score,
      level: myEntry.level,
      nextLevelAt,
      pointsToNextLevel,
    };
  }

  /**
   * Get next level threshold
   */
  private getNextLevelThreshold(currentLevel: string): number | null {
    switch (currentLevel) {
      case 'BEGINNER': return 65;  // PRO
      case 'PRO': return 80;       // TOP
      case 'TOP': return 90;       // ELITE
      case 'ELITE': return null;   // Already at max
      default: return 65;
    }
  }

  /**
   * Enhanced Coach Profile with Rank
   */
  async getCoachProfileWithRank(coachId: string) {
    const profile = await this.getCoachProfile(coachId);
    const rank = await this.getCoachRank(coachId);

    return {
      ...profile,
      rank: {
        position: rank.rank,
        totalCoaches: rank.totalCoaches,
        percentile: rank.percentile,
        nextLevelAt: rank.nextLevelAt,
        pointsToNextLevel: rank.pointsToNextLevel,
        badge: this.getRankBadge(rank.rank, rank.totalCoaches),
      },
    };
  }

  /**
   * Get rank badge/emoji
   */
  private getRankBadge(rank: number, total: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= Math.ceil(total * 0.1)) return '🌟'; // Top 10%
    if (rank <= Math.ceil(total * 0.25)) return '⭐'; // Top 25%
    return '';
  }

  // =============================
  // SETTINGS METHODS (PHASE 10)
  // =============================

  /**
   * Update coach profile (name, phone)
   */
  async updateCoachProfile(coachId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone) updateData.phone = data.phone;

    const user = await this.userModel.findByIdAndUpdate(
      coachId,
      { $set: updateData },
      { new: true }
    );

    if (!user) {
      throw new Error('Coach not found');
    }

    return {
      success: true,
      message: 'Профіль оновлено',
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }

  /**
   * Update coach avatar (base64)
   */
  async updateCoachAvatar(coachId: string, avatarBase64: string) {
    const user = await this.userModel.findByIdAndUpdate(
      coachId,
      { $set: { avatarUrl: avatarBase64 } },
      { new: true }
    );

    if (!user) {
      throw new Error('Coach not found');
    }

    return {
      success: true,
      message: 'Аватар оновлено',
      avatarUrl: user.avatarUrl,
    };
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(coachId: string) {
    const user = await this.userModel.findById(coachId);
    if (!user) {
      throw new Error('Coach not found');
    }

    // Default settings if not set
    const settings = user.notificationSettings || {
      pushEnabled: true,
      trainingReminders: true,
      studentAlerts: true,
      weeklyReport: true,
    };

    return settings;
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(coachId: string, settings: {
    pushEnabled?: boolean;
    trainingReminders?: boolean;
    studentAlerts?: boolean;
    weeklyReport?: boolean;
  }) {
    const user = await this.userModel.findById(coachId);
    if (!user) {
      throw new Error('Coach not found');
    }

    const currentSettings = user.notificationSettings || {};
    const newSettings = { ...currentSettings, ...settings };

    await this.userModel.findByIdAndUpdate(coachId, {
      $set: { notificationSettings: newSettings }
    });

    return {
      success: true,
      message: 'Налаштування сповіщень оновлено',
      settings: newSettings,
    };
  }

  /**
   * Get work schedule
   */
  async getWorkSchedule(coachId: string) {
    const user = await this.userModel.findById(coachId);
    if (!user) {
      throw new Error('Coach not found');
    }

    // Default schedule if not set
    const defaultSchedule = [
      { day: 'Понеділок', enabled: true, startTime: '09:00', endTime: '18:00' },
      { day: 'Вівторок', enabled: true, startTime: '09:00', endTime: '18:00' },
      { day: 'Середа', enabled: true, startTime: '09:00', endTime: '18:00' },
      { day: 'Четвер', enabled: true, startTime: '09:00', endTime: '18:00' },
      { day: 'П\'ятниця', enabled: true, startTime: '09:00', endTime: '18:00' },
      { day: 'Субота', enabled: false, startTime: '10:00', endTime: '14:00' },
      { day: 'Неділя', enabled: false, startTime: '10:00', endTime: '14:00' },
    ];

    return user.workSchedule || defaultSchedule;
  }

  /**
   * Update work schedule
   */
  async updateWorkSchedule(coachId: string, schedule: Array<{
    day: string;
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  }>) {
    const user = await this.userModel.findByIdAndUpdate(
      coachId,
      { $set: { workSchedule: schedule } },
      { new: true }
    );

    if (!user) {
      throw new Error('Coach not found');
    }

    return {
      success: true,
      message: 'Робочий графік оновлено',
      schedule: user.workSchedule,
    };
  }
}
