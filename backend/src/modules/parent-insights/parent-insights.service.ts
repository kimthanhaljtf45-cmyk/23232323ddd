import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { ProgressSnapshot, ProgressSnapshotDocument } from '../../schemas/progress-snapshot.schema';
import { Achievement, AchievementDocument } from '../../schemas/achievement.schema';
import { CoachComment, CoachCommentDocument } from '../../schemas/coach-comment.schema';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';

interface Alert {
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

interface Recommendation {
  type: string;
  title: string;
  action?: string;
}

export interface ChildInsight {
  childId: string;
  name: string;
  status: 'good' | 'warning' | 'critical';
  discipline: number;
  attendance: number;
  progressPercent: number;
  belt: string;
  alerts: Alert[];
  recommendations: Recommendation[];
  monthlyGoal: { target: number; current: number };
  lastCoachComment?: string;
  recentAchievements: any[];
}

@Injectable()
export class ParentInsightsService {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(ProgressSnapshot.name) private progressModel: Model<ProgressSnapshotDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(CoachComment.name) private commentModel: Model<CoachCommentDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  /**
   * P0.1 FIX: Use ONLY ParentChild collection for parent→child linking
   */
  private async getChildIdsForParent(parentId: string): Promise<string[]> {
    const links = await this.parentChildModel.find({ parentId });
    return links.map(l => l.childId);
  }

  async getInsights(parentId: string): Promise<{ children: ChildInsight[] }> {
    const childIds = await this.getChildIdsForParent(parentId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    const childInsights = await Promise.all(
      children.map(child => this.buildChildInsights(child)),
    );

    return { children: childInsights };
  }

  private async buildChildInsights(child: ChildDocument): Promise<ChildInsight> {
    const childId = child._id.toString();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const attendances = await this.attendanceModel.find({
      childId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });

    const totalAttendances = attendances.length;
    const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
    const warnedCount = attendances.filter(a => a.status === 'WARNED').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT').length;

    const attendancePercent = totalAttendances > 0 
      ? Math.round((presentCount / totalAttendances) * 100) 
      : 100;

    let disciplineScore = 100;
    disciplineScore -= absentCount * 15;
    disciplineScore -= warnedCount * 5;
    disciplineScore = Math.max(0, Math.min(100, disciplineScore));

    const recentAttendances = await this.attendanceModel
      .find({ childId })
      .sort({ date: -1 })
      .limit(5);
    
    const consecutiveAbsences = this.countConsecutiveAbsences(recentAttendances);

    const progress = await this.progressModel.findOne({ childId });
    const progressPercent = progress?.progressPercent || 0;

    const recentAchievements = await this.achievementModel
      .find({ childId })
      .sort({ awardedAt: -1 })
      .limit(3);

    const lastComment = await this.commentModel
      .findOne({ childId })
      .sort({ createdAt: -1 });

    const alerts: Alert[] = [];
    const recommendations: Recommendation[] = [];

    if (attendancePercent < 50) {
      alerts.push({
        type: 'CRITICAL_ATTENDANCE',
        title: 'Критична відвідуваність',
        message: `Менше 50% тренувань (${attendancePercent}%)`,
        severity: 'critical',
      });
      recommendations.push({
        type: 'ATTEND_URGENTLY',
        title: 'Терміново відвідати тренування',
        action: 'Зверніться до тренера',
      });
    } else if (attendancePercent < 70) {
      alerts.push({
        type: 'LOW_ATTENDANCE',
        title: 'Низька відвідуваність',
        message: `${attendancePercent}% тренувань`,
        severity: 'warning',
      });
      recommendations.push({
        type: 'ATTEND_MORE',
        title: 'Рекомендуємо відвідати 2 тренування цього тижня',
      });
    }

    if (consecutiveAbsences >= 3) {
      alerts.push({
        type: 'CONSECUTIVE_ABSENCES',
        title: 'Серія пропусків',
        message: `${consecutiveAbsences} тренувань поспіль пропущено`,
        severity: 'critical',
      });
    } else if (consecutiveAbsences >= 2) {
      alerts.push({
        type: 'ABSENCES_WARNING',
        title: 'Падає дисципліна',
        message: `Пропущено ${consecutiveAbsences} тренування поспіль`,
        severity: 'warning',
      });
    }

    if (disciplineScore < 60) {
      alerts.push({
        type: 'LOW_DISCIPLINE',
        title: 'Низька дисципліна',
        message: `Показник дисципліни: ${disciplineScore}%`,
        severity: 'warning',
      });
    }

    if (progressPercent >= 85) {
      alerts.push({
        type: 'READY_FOR_BELT',
        title: 'Готовий до поясу!',
        message: 'Прогрес досяг 85%, можна подаватись на атестацію',
        severity: 'info',
      });
      recommendations.push({
        type: 'CONTACT_COACH',
        title: 'Зверніться до тренера щодо атестації',
      });
    }

    if (progressPercent >= 70 && progressPercent < 85) {
      recommendations.push({
        type: 'KEEP_TRAINING',
        title: 'Відмінний прогрес! Продовжуйте в тому ж дусі',
      });
    }

    let status: 'good' | 'warning' | 'critical' = 'good';
    if (alerts.some(a => a.severity === 'critical')) {
      status = 'critical';
    } else if (alerts.some(a => a.severity === 'warning')) {
      status = 'warning';
    }

    const monthlyGoalTarget = child.monthlyGoalTarget || 12;

    return {
      childId,
      name: child.firstName,
      status,
      discipline: disciplineScore,
      attendance: attendancePercent,
      progressPercent,
      belt: child.belt || 'WHITE',
      alerts,
      recommendations,
      monthlyGoal: {
        target: monthlyGoalTarget,
        current: presentCount,
      },
      lastCoachComment: lastComment?.text,
      recentAchievements: recentAchievements.map(a => ({
        id: a._id.toString(),
        title: a.title,
        type: a.type,
        awardedAt: a.awardedAt,
      })),
    };
  }

  private countConsecutiveAbsences(attendances: AttendanceDocument[]): number {
    let count = 0;
    for (const a of attendances) {
      if (a.status === 'ABSENT') {
        count++;
      } else if (a.status === 'PRESENT') {
        break;
      }
    }
    return count;
  }

  // ==================== FINANCE (P0.4 FIX: Now using InvoiceModel) ====================

  async getFinanceOverview(parentUserId: string) {
    const childIds = await this.getChildIdsForParent(parentUserId);
    const children = await this.childModel.find({ _id: { $in: childIds } }).lean();

    // Get invoices for parent
    const invoices = await this.invoiceModel.find({ parentId: parentUserId }).lean();
    const totalPaid = invoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);
    const totalDebt = invoices
      .filter(i => i.status === 'OVERDUE' || i.status === 'PENDING')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);

    // Get subscriptions
    const subscriptions = await this.subscriptionModel.find({ parentId: parentUserId }).lean();

    return {
      totalPaid,
      totalDebt,
      activeSubscriptions: subscriptions.filter(s => s.status === 'ACTIVE').length,
      children: children.map(child => ({
        studentId: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        group: child.groupId || null,
        hasDebt: (child as any).hasDebt || false,
        debtAmount: (child as any).debtAmount || 0,
      })),
    };
  }

  /**
   * P0.4 FIX: Actually return invoices from InvoiceModel
   */
  async getParentInvoices(parentUserId: string) {
    const childIds = await this.getChildIdsForParent(parentUserId);
    const children = await this.childModel.find({ _id: { $in: childIds } }).lean();
    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    // Get real invoices
    const invoices = await this.invoiceModel.find({ parentId: parentUserId })
      .sort({ createdAt: -1 })
      .lean();

    return {
      invoices: invoices.map(inv => {
        const child = childMap.get(inv.childId);
        return {
          id: inv._id.toString(),
          amount: (inv as any).finalAmount || inv.amount,
          currency: inv.currency || 'UAH',
          status: inv.status,
          description: inv.description,
          dueDate: inv.dueDate,
          paidAt: inv.paidAt,
          studentName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
          childId: inv.childId,
        };
      }),
      children: children.map(c => ({
        id: c._id.toString(),
        name: `${c.firstName} ${c.lastName || ''}`.trim(),
        hasDebt: (c as any).hasDebt || false,
        debtAmount: (c as any).debtAmount || 0,
      })),
    };
  }
}
