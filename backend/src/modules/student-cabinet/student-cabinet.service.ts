import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { ProgressSnapshot, ProgressSnapshotDocument } from '../../schemas/progress-snapshot.schema';
import { CompetitionResult, CompetitionResultDocument } from '../../schemas/competition-result.schema';

@Injectable()
export class StudentCabinetService {
  private readonly logger = new Logger(StudentCabinetService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(ProgressSnapshot.name) private progressModel: Model<ProgressSnapshotDocument>,
    @InjectModel(CompetitionResult.name) private competitionResultModel: Model<CompetitionResultDocument>,
  ) {}

  private async findChildForUser(userId: string): Promise<ChildDocument | null> {
    // Student can be a child with userId set, or we look up by parentChild
    let child = await this.childModel.findOne({ userId });
    if (!child) {
      // Fallback: find any child linked to this user
      child = await this.childModel.findOne({ parentId: userId });
    }
    return child;
  }

  async getDashboard(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    const child = await this.findChildForUser(userId);

    // Get group & coach info
    let groupName = '';
    let coachName = '';
    if (child?.groupId) {
      const group = await this.groupModel.findById(child.groupId).lean();
      if (group) {
        groupName = group.name || '';
        if (group.coachId) {
          const coach = await this.userModel.findById(group.coachId).lean();
          coachName = coach ? `${coach.firstName} ${coach.lastName || ''}`.trim() : '';
        }
      }
    }

    // Attendance rate
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const childId = child?._id?.toString();
    let attendanceRate = 0;
    if (childId) {
      const attendances = await this.attendanceModel.find({
        childId,
        date: { $gte: startOfMonth.toISOString().split('T')[0] },
      }).lean();
      const present = attendances.filter(a => a.status === 'PRESENT').length;
      attendanceRate = attendances.length > 0 ? Math.round((present / attendances.length) * 100) : 0;
    }

    // Next training
    const today = now.toISOString().split('T')[0];
    let nextTraining: any = null;
    if (child?.groupId) {
      const schedule: any = await this.scheduleModel.findOne({
        groupId: child.groupId,
        date: { $gte: today },
      }).sort({ date: 1 }).lean();
      if (schedule) {
        nextTraining = {
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        };
      }
    }

    // Progress
    let belt = child?.belt || 'WHITE';
    let progressPercent = 0;
    if (childId) {
      const progress = await this.progressModel.findOne({ childId }).lean();
      if (progress) progressPercent = progress.progressPercent || 0;
    }

    // Unread messages count
    const unreadMessages = 0; // Will be connected to communication module

    // Debt
    let debt = 0;
    if (childId) {
      const unpaidInvoices = await this.invoiceModel.find({
        childId,
        status: { $in: ['PENDING', 'OVERDUE'] },
      }).lean();
      debt = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    }

    return {
      name: user ? `${user.firstName} ${user.lastName || ''}`.trim() : (child?.firstName || 'Учень'),
      belt,
      groupName,
      coachName,
      attendanceRate,
      nextTraining,
      progressPercent,
      unreadMessages,
      debt,
      childId,
    };
  }

  async getSchedule(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child?.groupId) return [];

    const now = new Date();
    const schedules: any[] = await this.scheduleModel.find({
      groupId: child.groupId,
      date: { $gte: now.toISOString().split('T')[0] },
    }).sort({ date: 1 }).limit(14).lean();

    return schedules.map((s: any) => ({
      id: s._id?.toString(),
      date: s.date,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status || 'SCHEDULED',
    }));
  }

  async getAttendance(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child) return { records: [], rate: 0, total: 0, present: 0, absent: 0 };

    const childId = child._id.toString();
    const attendances = await this.attendanceModel.find({ childId })
      .sort({ date: -1 })
      .limit(30)
      .lean();

    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const rate = attendances.length > 0 ? Math.round((present / attendances.length) * 100) : 0;

    return {
      records: attendances.map(a => ({
        date: a.date,
        status: a.status,
      })),
      rate,
      total: attendances.length,
      present,
      absent,
    };
  }

  async getProgress(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child) return { belt: 'WHITE', progressPercent: 0, nextBelt: 'YELLOW', isReadyForExam: false };

    const childId = child._id.toString();
    const progress: any = await this.progressModel.findOne({ childId }).lean();

    const beltOrder = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'];
    const currentBelt = child.belt || 'WHITE';
    const idx = beltOrder.indexOf(currentBelt);
    const nextBelt = idx < beltOrder.length - 1 ? beltOrder[idx + 1] : 'BLACK';
    const progressPercent = progress?.progressPercent || 0;

    return {
      belt: currentBelt,
      progressPercent,
      nextBelt,
      isReadyForExam: progressPercent >= 85,
      totalTrainings: progress?.totalTrainings || 0,
      beltHistory: beltOrder.slice(0, idx + 1).map(b => ({ belt: b, achieved: true })),
    };
  }

  async getSubscription(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child) return null;

    const sub: any = await this.subscriptionModel.findOne({
      childId: child._id.toString(),
      status: 'ACTIVE',
    }).lean();

    if (!sub) return null;

    return {
      id: sub._id?.toString(),
      planName: sub.planName || 'Місяць',
      price: sub.price || 0,
      status: sub.status,
      startDate: sub.startDate,
      nextBillingAt: sub.nextBillingAt,
      currency: sub.currency || 'UAH',
    };
  }

  async getFinance(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child) return { debt: 0, invoices: [] };

    const childId = child._id.toString();
    const invoices = await this.invoiceModel.find({
      childId,
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ dueDate: 1 }).lean();

    const debt = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return {
      debt,
      currency: 'UAH',
      invoices: invoices.map(inv => ({
        id: inv._id?.toString(),
        amount: inv.amount,
        description: inv.description,
        dueDate: inv.dueDate,
        status: inv.status,
      })),
    };
  }

  async getCompetitions(userId: string) {
    const child = await this.findChildForUser(userId);
    if (!child) return [];

    const childId = child._id.toString();
    const results: any[] = await this.competitionResultModel.find({ childId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return results.map((r: any) => ({
      id: r._id?.toString(),
      medal: r.medal,
      place: r.place,
      competitionId: r.competitionId,
      awardType: r.awardType,
      date: r.createdAt,
    }));
  }
}
