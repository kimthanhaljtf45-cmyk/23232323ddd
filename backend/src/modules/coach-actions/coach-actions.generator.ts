import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { CoachActionsService, CreateCoachActionDto } from './coach-actions.service';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Alert, AlertDocument } from '../../schemas/alert.schema';
import { MessageThread, MessageThreadDocument } from '../../schemas/message-thread.schema';

@Injectable()
export class CoachActionsGenerator {
  private readonly logger = new Logger(CoachActionsGenerator.name);

  constructor(
    private readonly actionsService: CoachActionsService,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThreadDocument>,
  ) {}

  // Run every 6 hours
  @Cron('0 */6 * * *')
  async syncAllCoaches() {
    this.logger.log('Syncing coach actions...');
    const coaches = await this.userModel.find({ role: 'COACH' }).exec();
    
    for (const coach of coaches) {
      await this.syncForCoach((coach as any)._id.toString());
    }
    this.logger.log(`Synced actions for ${coaches.length} coaches`);
  }

  async syncForCoach(coachId: string): Promise<{ actionsCreated: number }> {
    let count = 0;

    try {
      count += await this.checkChildrenAtRisk(coachId);
      count += await this.checkBeltReady(coachId);
      count += await this.checkUnreadMessages(coachId);
      count += await this.checkUnclosedAttendance(coachId);
    } catch (error) {
      this.logger.error(`Error syncing actions for coach ${coachId}:`, error);
    }

    return { actionsCreated: count };
  }

  private async checkChildrenAtRisk(coachId: string): Promise<number> {
    let count = 0;

    // Get groups for this coach
    const groups = await this.groupModel.find({ coachId }).exec();
    const groupIds = groups.map(g => (g as any)._id.toString());

    // Get critical alerts for children in these groups
    const children = await this.childModel.find({
      groupId: { $in: groupIds },
      status: 'ACTIVE',
    }).exec();

    for (const child of children) {
      const childId = (child as any)._id.toString();

      // Check for critical alerts
      const criticalAlerts = await this.alertModel.find({
        childId,
        severity: 'critical',
        isResolved: false,
      }).exec();

      for (const alert of criticalAlerts) {
        await this.actionsService.create({
          coachId,
          type: 'REVIEW_CHILD_RISK',
          severity: 'critical',
          title: `Переглянути ${child.firstName}`,
          message: alert.title,
          childId,
          groupId: child.groupId,
          alertId: (alert as any)._id.toString(),
          screen: '/(coach)/groups/[id]',
          params: { id: child.groupId, childId },
        });
        count++;
      }

      // Check 2+ consecutive absences
      const recentAttendance = await this.attendanceModel.find({
        childId,
      }).sort({ date: -1 }).limit(5).exec();

      let consecutiveAbsences = 0;
      for (const a of recentAttendance) {
        if (a.status === 'ABSENT') consecutiveAbsences++;
        else break;
      }

      if (consecutiveAbsences >= 2) {
        await this.actionsService.create({
          coachId,
          type: 'CHECK_ABSENCES',
          severity: consecutiveAbsences >= 3 ? 'critical' : 'warning',
          title: `${child.firstName}: ${consecutiveAbsences} пропусків`,
          message: `Перевірте причину пропусків`,
          childId,
          groupId: child.groupId,
          screen: '/(coach)/attendance',
          params: { childId },
        });
        count++;
      }
    }

    return count;
  }

  private async checkBeltReady(coachId: string): Promise<number> {
    let count = 0;

    const groups = await this.groupModel.find({ coachId }).exec();
    const groupIds = groups.map(g => (g as any)._id.toString());

    const readyChildren = await this.childModel.find({
      groupId: { $in: groupIds },
      coachApprovedForNextBelt: true,
      status: 'ACTIVE',
    }).exec();

    for (const child of readyChildren) {
      await this.actionsService.create({
        coachId,
        type: 'CONFIRM_BELT',
        severity: 'info',
        title: `${child.firstName}: підтвердити пояс`,
        message: `Поточний: ${child.belt}`,
        childId: (child as any)._id.toString(),
        groupId: child.groupId,
        screen: '/(coach)/groups/[id]',
        params: { id: child.groupId, childId: (child as any)._id.toString() },
      });
      count++;
    }

    return count;
  }

  private async checkUnreadMessages(coachId: string): Promise<number> {
    let count = 0;

    // Find threads where coach has unread messages
    const threads = await this.threadModel.find({
      coachId,
      lastMessageAt: { $exists: true },
    }).exec();

    for (const thread of threads) {
      // Simple check - if lastMessageSenderId != coachId, might need reply
      if ((thread as any).lastMessageSenderId !== coachId) {
        const parent = await this.userModel.findById(thread.parentId).exec();
        if (parent) {
          await this.actionsService.create({
            coachId,
            type: 'REPLY_PARENT',
            severity: 'warning',
            title: `Відповісти ${parent.firstName}`,
            message: 'Є непрочитане повідомлення',
            parentId: (parent as any)._id.toString(),
            screen: '/(coach)/messages/[id]',
            params: { id: (thread as any)._id.toString() },
          });
          count++;
        }
      }
    }

    return count;
  }

  private async checkUnclosedAttendance(coachId: string): Promise<number> {
    let count = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups = await this.groupModel.find({ coachId }).exec();

    for (const group of groups) {
      // Check if there are children without attendance for today's session
      const children = await this.childModel.find({
        groupId: (group as any)._id.toString(),
        status: 'ACTIVE',
      }).exec();

      for (const child of children) {
        const todayAttendance = await this.attendanceModel.findOne({
          childId: (child as any)._id.toString(),
          date: { $gte: today },
        }).exec();

        if (!todayAttendance) {
          // There might be unclosed attendance
          await this.actionsService.create({
            coachId,
            type: 'CLOSE_ATTENDANCE',
            severity: 'info',
            title: `Закрити відвідуваність`,
            message: `Група: ${group.name}`,
            groupId: (group as any)._id.toString(),
            screen: '/(coach)/attendance',
            params: { groupId: (group as any)._id.toString() },
          });
          count++;
          break; // One action per group is enough
        }
      }
    }

    return count;
  }
}
