import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { ParentChild, ParentChildDocument } from '../../../schemas/parent-child.schema';
import { Invoice, InvoiceDocument } from '../../../schemas/invoice.schema';
import { Schedule, ScheduleDocument } from '../../../schemas/schedule.schema';
import { CoachComment, CoachCommentDocument } from '../../../schemas/coach-comment.schema';
import { MessageThread, MessageThreadDocument } from '../../../schemas/message-thread.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Parent Special Builder
 * For parents with children in SPECIAL program (adaptive approach)
 * NO competitive elements: no ratings, no leaderboards, no tournament pressure
 */
@Injectable()
export class ParentSpecialBuilder {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(CoachComment.name) private commentModel: Model<CoachCommentDocument>,
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThreadDocument>,
  ) {}

  async build(user: any) {
    const userId = user._id.toString();
    
    // Get children
    const parentChildren = await this.parentChildModel.find({ parentId: userId });
    const childIds = parentChildren.map(pc => pc.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } });

    // Build children stability insights (soft approach)
    const childrenStability = await Promise.all(children.map(c => this.buildChildStability(c)));

    // Extract alerts (only critical ones, softer messaging)
    const alerts = this.extractAlerts(childrenStability);

    // Get pending payments
    const pendingInvoices = await this.invoiceModel.find({
      childId: { $in: childIds.map(id => id.toString()) },
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ dueDate: 1 }).limit(3);

    // Get next trainings
    const nextTrainings = await this.getNextTrainings(children);

    // Get unread messages count
    const unreadMessages = await this.getUnreadMessagesCount(userId);

    // Build recommendations
    const recommendations = this.buildRecommendations(childrenStability);

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Critical Alerts (softer messaging)
    if (alerts.length > 0) {
      blocks.push({
        type: 'CRITICAL_ALERTS',
        priority: 1,
        items: alerts,
      });
    }

    // 2. Child Stability Block (main block for SPECIAL program)
    blocks.push({
      type: 'CHILD_STABILITY',
      priority: 2,
      items: childrenStability.map(c => ({
        childId: c.childId,
        name: c.name,
        attendance: c.attendance,
        trend: c.trend,
        stabilityScore: c.stabilityScore,
        coachCommentSummary: c.coachCommentSummary,
        moodIndicator: c.moodIndicator,
      })),
    });

    // 3. Coach Comment Block (important for SPECIAL)
    const childrenWithComments = childrenStability.filter(c => c.lastCoachComment);
    if (childrenWithComments.length > 0) {
      blocks.push({
        type: 'COACH_COMMENT',
        priority: 3,
        items: childrenWithComments.map(c => ({
          childId: c.childId,
          name: c.name,
          comment: c.lastCoachComment,
          commentDate: c.commentDate,
        })),
      });
    }

    // 4. Recommendations Block
    if (recommendations.length > 0) {
      blocks.push({
        type: 'RECOMMENDATIONS',
        priority: 4,
        items: recommendations,
      });
    }

    // 5. Attendance Care Block (softer naming)
    blocks.push({
      type: 'ATTENDANCE_CARE',
      priority: 5,
      items: childrenStability.map(c => ({
        childId: c.childId,
        name: c.name,
        thisMonth: c.thisMonthAttendance,
        lastMonth: c.lastMonthAttendance,
        message: this.getAttendanceMessage(c),
      })),
    });

    // 6. Payment Status Block
    if (pendingInvoices.length > 0) {
      blocks.push({
        type: 'PAYMENT_STATUS',
        priority: 6,
        items: pendingInvoices.map(inv => ({
          id: inv._id.toString(),
          childId: inv.childId,
          amount: inv.amount,
          currency: inv.currency || 'UAH',
          description: inv.description,
          status: inv.status,
          dueDate: inv.dueDate,
        })),
      });
    }

    // 7. Next Trainings Block
    if (nextTrainings.length > 0) {
      blocks.push({
        type: 'NEXT_TRAININGS',
        priority: 7,
        items: nextTrainings,
      });
    }

    // 8. Quick Actions Block (simplified for SPECIAL)
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 8,
      items: [
        { title: 'Розклад', icon: 'calendar-outline', screen: '/(tabs)/schedule' },
        { title: 'Повідомлення тренеру', icon: 'chatbubble-outline', screen: '/messages', badge: unreadMessages > 0 ? unreadMessages : undefined },
        { title: 'Оплати', icon: 'card-outline', screen: '/payments' },
      ],
    });

    return {
      role: 'PARENT',
      programType: 'SPECIAL',
      header: {
        title: 'Стан дитини',
        subtitle: 'Підтримка, стабільність, розвиток',
      },
      state: {
        hasCriticalAlerts: alerts.length > 0,
        hasUnreadMessages: unreadMessages > 0,
        hasPendingPayments: pendingInvoices.length > 0,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private async buildChildStability(child: ChildDocument) {
    const childId = child._id.toString();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // This month attendance
    const thisMonthAtt = await this.attendanceModel.find({
      childId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });
    const thisMonthPresent = thisMonthAtt.filter(a => a.status === 'PRESENT').length;
    const thisMonthTotal = thisMonthAtt.length || 1;
    const thisMonthAttendance = Math.round((thisMonthPresent / thisMonthTotal) * 100);

    // Last month attendance
    const lastMonthAtt = await this.attendanceModel.find({
      childId,
      date: {
        $gte: startOfLastMonth.toISOString().split('T')[0],
        $lt: startOfMonth.toISOString().split('T')[0],
      },
    });
    const lastMonthPresent = lastMonthAtt.filter(a => a.status === 'PRESENT').length;
    const lastMonthTotal = lastMonthAtt.length || 1;
    const lastMonthAttendance = Math.round((lastMonthPresent / lastMonthTotal) * 100);

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (thisMonthAttendance - lastMonthAttendance > 10) trend = 'up';
    else if (lastMonthAttendance - thisMonthAttendance > 10) trend = 'down';

    // Stability score (simpler than discipline, more supportive)
    const stabilityScore = Math.round((thisMonthAttendance + lastMonthAttendance) / 2);

    // Get latest coach comment
    const lastComment = await this.commentModel
      .findOne({ childId })
      .sort({ createdAt: -1 });

    // Mood indicator based on stability (gentle approach)
    let moodIndicator: 'happy' | 'neutral' | 'needs-support' = 'neutral';
    if (stabilityScore >= 70) moodIndicator = 'happy';
    else if (stabilityScore < 50) moodIndicator = 'needs-support';

    return {
      childId,
      name: child.firstName,
      attendance: thisMonthAttendance,
      thisMonthAttendance,
      lastMonthAttendance,
      trend,
      stabilityScore,
      moodIndicator,
      lastCoachComment: lastComment?.text,
      commentDate: lastComment?.createdAt,
      coachCommentSummary: lastComment?.text?.substring(0, 50) + '...' || 'Немає коментарів',
    };
  }

  private extractAlerts(childrenStability: any[]) {
    const alerts: any[] = [];
    for (const c of childrenStability) {
      if (c.moodIndicator === 'needs-support') {
        alerts.push({
          type: 'NEEDS_SUPPORT',
          title: `${c.name} потребує уваги`,
          message: 'Рекомендуємо звернутись до тренера',
          severity: 'warning',
          childId: c.childId,
          screen: '/child/[id]',
          params: { id: c.childId },
        });
      }
      if (c.trend === 'down') {
        alerts.push({
          type: 'TREND_DOWN',
          title: `${c.name}: зниження відвідуваності`,
          message: 'Спостерігається зниження активності',
          severity: 'info',
          childId: c.childId,
        });
      }
    }
    return alerts;
  }

  private buildRecommendations(childrenStability: any[]) {
    const recommendations: any[] = [];
    
    for (const c of childrenStability) {
      if (c.trend === 'up') {
        recommendations.push({
          type: 'POSITIVE_TREND',
          childId: c.childId,
          title: `${c.name} показує прогрес!`,
          action: 'Підтримайте та похваліть',
        });
      }
      if (!c.lastCoachComment) {
        recommendations.push({
          type: 'REQUEST_FEEDBACK',
          childId: c.childId,
          title: `Запитайте зворотній зв'язок про ${c.name}`,
          action: 'Напишіть тренеру',
        });
      }
    }

    return recommendations;
  }

  private getAttendanceMessage(c: any): string {
    if (c.thisMonthAttendance >= 80) return 'Чудова стабільність!';
    if (c.thisMonthAttendance >= 60) return 'Непогано, продовжуйте';
    return 'Рекомендуємо частіше відвідувати';
  }

  private async getNextTrainings(children: ChildDocument[]) {
    const groupIds = children.map(c => c.groupId).filter(Boolean);
    const schedules = await this.scheduleModel.find({ groupId: { $in: groupIds }, isActive: true });

    const now = new Date();
    const dayOfWeek = now.getDay() || 7;

    const nextTrainings: any[] = [];
    for (const s of schedules) {
      let daysUntil = s.dayOfWeek - dayOfWeek;
      if (daysUntil <= 0) daysUntil += 7;
      
      const date = new Date(now);
      date.setDate(date.getDate() + daysUntil);

      const child = children.find(c => c.groupId?.toString() === s.groupId?.toString());
      
      nextTrainings.push({
        childId: child?._id.toString(),
        childName: child?.firstName,
        date: date.toISOString().split('T')[0],
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }

    return nextTrainings.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }

  private async getUnreadMessagesCount(userId: string): Promise<number> {
    const threads = await this.threadModel.find({ parentId: userId });
    return threads.reduce((sum, t) => sum + (t.unreadParent || 0), 0);
  }
}
