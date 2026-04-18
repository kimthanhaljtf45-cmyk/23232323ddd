import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../schemas/user.schema';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { Group, GroupDocument } from '../../../schemas/group.schema';
import { Schedule, ScheduleDocument } from '../../../schemas/schedule.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { MessageThread, MessageThreadDocument } from '../../../schemas/message-thread.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Coach Dashboard Builder
 * Shows: today's schedules, priority actions, group health, parent messages
 */
@Injectable()
export class CoachDashboardBuilder {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThreadDocument>,
  ) {}

  async build(user: any) {
    const coachId = user._id.toString();

    // Get coach's groups
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map(g => g._id.toString());

    // Get today's schedules
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const todaySchedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      dayOfWeek,
      isActive: true,
    }).populate('groupId');

    // Get children in coach's groups
    const children = await this.childModel.find({ groupId: { $in: groupIds } });

    // Get group health metrics
    const groupHealth = await this.calculateGroupHealth(groupIds);

    // Get unread parent threads
    const unreadThreads = await this.threadModel.find({
      coachId,
      unreadCoach: { $gt: 0 },
    });

    // Get children ready for belt approval
    const beltApprovalQueue = children.filter(c => c.coachApprovedForNextBelt === false);

    // Build priority actions
    const priorityActions = this.buildPriorityActions(todaySchedules, unreadThreads, beltApprovalQueue);

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Priority Actions Block
    if (priorityActions.length > 0) {
      blocks.push({
        type: 'PRIORITY_ACTIONS',
        priority: 1,
        items: priorityActions,
      });
    }

    // 2. Today's Schedules Block
    blocks.push({
      type: 'TODAY_SCHEDULES',
      priority: 2,
      items: todaySchedules.map(s => {
        const group = s.groupId as any;
        return {
          scheduleId: s._id.toString(),
          groupId: group?._id?.toString(),
          groupName: group?.name || 'Група',
          startTime: s.startTime,
          endTime: s.endTime,
          studentsCount: children.filter(c => c.groupId?.toString() === group?._id?.toString()).length,
          screen: '/coach/attendance/[scheduleId]',
          params: { scheduleId: s._id.toString() },
        };
      }),
    });

    // 3. Group Health Block
    blocks.push({
      type: 'GROUP_HEALTH',
      priority: 3,
      items: groupHealth,
    });

    // 4. Belt Approval Queue Block
    if (beltApprovalQueue.length > 0) {
      blocks.push({
        type: 'BELT_APPROVAL_QUEUE',
        priority: 4,
        items: beltApprovalQueue.map(c => ({
          childId: c._id.toString(),
          name: `${c.firstName} ${c.lastName || ''}`.trim(),
          currentBelt: c.belt || 'WHITE',
          groupId: c.groupId?.toString(),
        })),
      });
    }

    // 5. Unread Parent Threads Block
    if (unreadThreads.length > 0) {
      blocks.push({
        type: 'UNREAD_PARENT_THREADS',
        priority: 5,
        items: unreadThreads.map(t => ({
          threadId: t._id.toString(),
          parentId: t.parentId,
          unreadCount: t.unreadCoach,
          lastMessageAt: t.lastMessageAt,
        })),
      });
    }

    // 6. Quick Actions Block
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 6,
      items: [
        { title: 'Відмітити відвідуваність', icon: 'checkmark-circle-outline', screen: '/coach' },
        { title: 'Повідомлення', icon: 'chatbubble-outline', screen: '/messages', badge: unreadThreads.length > 0 ? unreadThreads.length : undefined },
        { title: 'Розклад', icon: 'calendar-outline', screen: '/(tabs)/schedule' },
      ],
    });

    return {
      role: 'COACH',
      programType: 'COACH',
      header: {
        title: `Привіт, ${user.firstName}!`,
        subtitle: `${todaySchedules.length} тренувань сьогодні`,
      },
      state: {
        todayTrainingsCount: todaySchedules.length,
        unreadMessagesCount: unreadThreads.reduce((sum, t) => sum + (t.unreadCoach || 0), 0),
        beltApprovalCount: beltApprovalQueue.length,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private async calculateGroupHealth(groupIds: string[]) {
    const results: any[] = [];

    for (const groupId of groupIds) {
      const group = await this.groupModel.findById(groupId);
      const children = await this.childModel.find({ groupId });
      
      // Calculate average attendance
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let totalAttendance = 0;
      let totalChildren = 0;

      for (const child of children) {
        const attendances = await this.attendanceModel.find({
          childId: child._id.toString(),
          date: { $gte: startOfMonth.toISOString().split('T')[0] },
        });
        const present = attendances.filter(a => a.status === 'PRESENT').length;
        const total = attendances.length || 1;
        totalAttendance += (present / total) * 100;
        totalChildren++;
      }

      const avgAttendance = totalChildren > 0 ? Math.round(totalAttendance / totalChildren) : 0;

      results.push({
        groupId,
        name: group?.name || 'Група',
        studentsCount: children.length,
        avgAttendance,
        status: avgAttendance >= 70 ? 'good' : avgAttendance >= 50 ? 'warning' : 'critical',
      });
    }

    return results;
  }

  private buildPriorityActions(todaySchedules: any[], unreadThreads: any[], beltApprovalQueue: any[]) {
    const actions: any[] = [];

    if (todaySchedules.length > 0) {
      actions.push({
        type: 'MARK_ATTENDANCE',
        title: 'Відмітити відвідуваність',
        message: `${todaySchedules.length} тренувань сьогодні`,
        severity: 'critical',
        screen: '/coach',
      });
    }

    if (unreadThreads.length > 0) {
      actions.push({
        type: 'RESPOND_PARENTS',
        title: 'Відповісти батькам',
        message: `${unreadThreads.length} непрочитаних повідомлень`,
        severity: 'warning',
        screen: '/messages',
      });
    }

    if (beltApprovalQueue.length > 0) {
      actions.push({
        type: 'BELT_APPROVAL',
        title: 'Атестація на пояс',
        message: `${beltApprovalQueue.length} учнів чекають`,
        severity: 'info',
      });
    }

    return actions;
  }
}
