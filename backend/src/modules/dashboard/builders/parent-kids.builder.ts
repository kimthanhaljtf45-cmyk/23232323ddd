import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { ParentChild, ParentChildDocument } from '../../../schemas/parent-child.schema';
import { Invoice, InvoiceDocument } from '../../../schemas/invoice.schema';
import { ContentPost, ContentPostDocument } from '../../../schemas/content-post.schema';
import { Notification, NotificationDocument } from '../../../schemas/notification.schema';
import { Schedule, ScheduleDocument } from '../../../schemas/schedule.schema';
import { Achievement, AchievementDocument } from '../../../schemas/achievement.schema';
import { CoachComment, CoachCommentDocument } from '../../../schemas/coach-comment.schema';
import { ProgressSnapshot, ProgressSnapshotDocument } from '../../../schemas/progress-snapshot.schema';
import { MessageThread, MessageThreadDocument } from '../../../schemas/message-thread.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

@Injectable()
export class ParentKidsBuilder {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(ContentPost.name) private contentModel: Model<ContentPostDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(CoachComment.name) private commentModel: Model<CoachCommentDocument>,
    @InjectModel(ProgressSnapshot.name) private progressModel: Model<ProgressSnapshotDocument>,
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThreadDocument>,
  ) {}

  async build(user: any) {
    const userId = user._id.toString();
    
    // Get children
    const parentChildren = await this.parentChildModel.find({ parentId: userId });
    const childIds = parentChildren.map(pc => pc.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } }).populate('groupId');

    // Build children insights
    const childrenInsights = await Promise.all(children.map(c => this.buildChildInsight(c)));

    // Get critical alerts
    const criticalAlerts = this.extractCriticalAlerts(childrenInsights);

    // Get pending payments
    const pendingInvoices = await this.invoiceModel.find({
      childId: { $in: childIds.map(id => id.toString()) },
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ dueDate: 1 }).limit(5);

    // Get unread notifications
    const notifications = await this.notificationModel
      .find({ userId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get feed preview
    const feedPosts = await this.contentModel
      .find({ visibility: 'GLOBAL' })
      .sort({ publishedAt: -1, isPinned: -1 })
      .limit(3);

    // Get next trainings
    const nextTrainings = await this.getNextTrainings(children);

    // Get unread messages count
    const unreadMessages = await this.getUnreadMessagesCount(userId);

    // Build state flags
    const hasCriticalAlerts = criticalAlerts.length > 0;
    const hasUnreadMessages = unreadMessages > 0;
    const hasPendingPayments = pendingInvoices.length > 0;

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Critical Alerts Block
    if (criticalAlerts.length > 0) {
      blocks.push({
        type: 'CRITICAL_ALERTS',
        priority: 1,
        items: criticalAlerts,
      });
    }

    // 2. Children Overview Block
    blocks.push({
      type: 'CHILDREN_OVERVIEW',
      priority: 2,
      items: childrenInsights.map(c => ({
        childId: c.childId,
        name: c.name,
        belt: c.belt,
        progressPercent: c.progressPercent,
        attendancePercent: c.attendance,
        disciplineScore: c.discipline,
        status: c.status,
        groupName: c.groupName,
      })),
    });

    // 3. Belt Ready Block (if any child is ready)
    const beltReadyChildren = childrenInsights.filter(c => c.progressPercent >= 85);
    if (beltReadyChildren.length > 0) {
      blocks.push({
        type: 'BELT_READY',
        priority: 3,
        items: beltReadyChildren.map(c => ({
          childId: c.childId,
          name: c.name,
          currentBelt: c.belt,
          progressPercent: c.progressPercent,
          message: 'Готовий до атестації на наступний пояс',
        })),
      });
    }

    // 4. Monthly Goals Block
    blocks.push({
      type: 'MONTHLY_GOALS',
      priority: 4,
      items: childrenInsights.map(c => ({
        childId: c.childId,
        name: c.name,
        target: c.monthlyGoal.target,
        current: c.monthlyGoal.current,
        percent: Math.round((c.monthlyGoal.current / c.monthlyGoal.target) * 100),
      })),
    });

    // 5. Payment Status Block
    if (pendingInvoices.length > 0) {
      blocks.push({
        type: 'PAYMENT_STATUS',
        priority: 5,
        items: pendingInvoices.map(inv => ({
          id: inv._id.toString(),
          childId: inv.childId,
          amount: inv.amount,
          currency: inv.currency || 'UAH',
          description: inv.description,
          status: inv.status,
          dueDate: inv.dueDate,
          screen: '/(parent)/payments/[id]',
          params: { id: inv._id.toString() },
        })),
      });
    }

    // 6. Next Trainings Block
    if (nextTrainings.length > 0) {
      blocks.push({
        type: 'NEXT_TRAININGS',
        priority: 6,
        items: nextTrainings,
      });
    }

    // 7. Quick Actions Block
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 7,
      items: [
        { title: 'Розклад', icon: 'calendar-outline', screen: '/(tabs)/schedule' },
        { title: 'Оплати', icon: 'card-outline', screen: '/payments' },
        { title: 'Повідомлення', icon: 'chatbubble-outline', screen: '/messages', badge: unreadMessages > 0 ? unreadMessages : undefined },
        { title: 'Рейтинг', icon: 'trophy-outline', screen: '/rating' },
      ],
    });

    // 8. Feed Preview Block
    if (feedPosts.length > 0) {
      blocks.push({
        type: 'FEED_PREVIEW',
        priority: 8,
        items: feedPosts.map(p => ({
          id: p._id.toString(),
          title: p.title,
          body: p.body?.substring(0, 100) + '...',
          type: p.type,
          isPinned: p.isPinned,
          publishedAt: p.publishedAt,
        })),
      });
    }

    // 9. Notifications Preview Block
    if (notifications.length > 0) {
      blocks.push({
        type: 'NOTIFICATIONS_PREVIEW',
        priority: 9,
        items: notifications.map(n => ({
          id: n._id.toString(),
          type: n.type,
          title: n.title,
          body: n.body,
          createdAt: n.createdAt,
        })),
      });
    }

    return {
      role: 'PARENT',
      programType: 'KIDS',
      header: {
        title: 'Контроль дітей',
        subtitle: 'Стан дітей у школі АТАКА',
      },
      state: {
        hasCriticalAlerts,
        hasUnreadMessages,
        hasPendingPayments,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private async buildChildInsight(child: ChildDocument) {
    const childId = child._id.toString();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get attendance
    const attendances = await this.attendanceModel.find({
      childId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });

    const total = attendances.length || 1;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const attendance = Math.round((present / total) * 100);

    // Calculate discipline
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const warned = attendances.filter(a => a.status === 'WARNED').length;
    let discipline = 100 - (absent * 15) - (warned * 5);
    discipline = Math.max(0, Math.min(100, discipline));

    // Get progress
    const progress = await this.progressModel.findOne({ childId });
    const progressPercent = progress?.progressPercent || 0;

    // Build alerts
    const alerts: any[] = [];
    
    if (attendance < 50) {
      alerts.push({
        type: 'CRITICAL_ATTENDANCE',
        title: 'Критична відвідуваність',
        message: `${attendance}% тренувань`,
        severity: 'critical',
      });
    } else if (attendance < 70) {
      alerts.push({
        type: 'LOW_ATTENDANCE',
        title: 'Низька відвідуваність',
        message: `${attendance}% тренувань`,
        severity: 'warning',
      });
    }

    if (discipline < 60) {
      alerts.push({
        type: 'LOW_DISCIPLINE',
        title: 'Низька дисципліна',
        message: `Показник: ${discipline}%`,
        severity: 'warning',
      });
    }

    // Determine status
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (alerts.some(a => a.severity === 'critical')) status = 'critical';
    else if (alerts.some(a => a.severity === 'warning')) status = 'warning';

    const group = child.groupId as any;

    return {
      childId,
      name: child.firstName,
      belt: child.belt || 'WHITE',
      progressPercent,
      attendance,
      discipline,
      status,
      alerts,
      groupName: group?.name || '',
      monthlyGoal: {
        target: child.monthlyGoalTarget || 12,
        current: present,
      },
    };
  }

  private extractCriticalAlerts(childrenInsights: any[]) {
    const alerts: any[] = [];
    for (const c of childrenInsights) {
      for (const a of c.alerts) {
        alerts.push({
          ...a,
          childId: c.childId,
          childName: c.name,
          title: `${c.name}: ${a.title}`,
          screen: '/child/[id]',
          params: { id: c.childId },
        });
      }
    }
    return alerts;
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
        scheduleId: s._id.toString(),
        childId: child?._id.toString(),
        childName: child?.firstName,
        date: date.toISOString().split('T')[0],
        startTime: s.startTime,
        endTime: s.endTime,
        dayOfWeek: s.dayOfWeek,
      });
    }

    return nextTrainings.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }

  private async getUnreadMessagesCount(userId: string): Promise<number> {
    const threads = await this.threadModel.find({ parentId: userId });
    return threads.reduce((sum, t) => sum + (t.unreadParent || 0), 0);
  }
}
