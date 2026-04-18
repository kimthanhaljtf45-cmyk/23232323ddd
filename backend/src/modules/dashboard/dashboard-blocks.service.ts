import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { ContentPost, ContentPostDocument } from '../../schemas/content-post.schema';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { MessageThread, MessageThreadDocument } from '../../schemas/message-thread.schema';

export interface DashboardBlock {
  type: string;
  priority: number;
  items: any[];
}

@Injectable()
export class DashboardBlocksService {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(ContentPost.name) private contentModel: Model<ContentPostDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(MessageThread.name) private threadModel: Model<MessageThreadDocument>,
  ) {}

  async getParentChildren(parentId: string): Promise<ChildDocument[]> {
    const links = await this.parentChildModel.find({ parentId });
    const childIds = links.map(l => l.childId);
    return this.childModel.find({ _id: { $in: childIds } }).populate('groupId');
  }

  async getPendingPayments(parentId: string) {
    const children = await this.getParentChildren(parentId);
    const childIds = children.map(c => c._id.toString());
    
    const invoices = await this.invoiceModel.find({
      childId: { $in: childIds },
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ dueDate: 1 }).limit(5);

    return invoices.map(inv => ({
      id: inv._id.toString(),
      childId: inv.childId,
      amount: inv.amount,
      currency: inv.currency || 'UAH',
      description: inv.description,
      status: inv.status,
      dueDate: inv.dueDate,
    }));
  }

  async getUnreadNotifications(userId: string, limit = 5) {
    const notifications = await this.notificationModel
      .find({ userId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(limit);

    return notifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
    }));
  }

  async getFeedPreview(limit = 3) {
    const posts = await this.contentModel
      .find({ visibility: 'GLOBAL' })
      .sort({ publishedAt: -1 })
      .limit(limit);

    return posts.map(p => ({
      id: p._id.toString(),
      title: p.title,
      body: p.body?.substring(0, 100),
      type: p.type,
      publishedAt: p.publishedAt,
    }));
  }

  async getUnreadMessagesCount(userId: string): Promise<number> {
    const threads = await this.threadModel.find({
      $or: [{ parentId: userId }, { coachId: userId }],
    });
    
    let count = 0;
    for (const t of threads) {
      count += t.unreadParent || 0;
      count += t.unreadCoach || 0;
    }
    return count;
  }

  async getNextTrainings(childIds: string[], limit = 3) {
    const children = await this.childModel.find({ _id: { $in: childIds } });
    const groupIds = children.map(c => c.groupId).filter(Boolean);
    
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
    
    const schedules = await this.scheduleModel
      .find({ groupId: { $in: groupIds }, isActive: true })
      .populate('groupId');

    // Find next occurrences
    const nextTrainings: any[] = [];
    for (const s of schedules) {
      let daysUntil = s.dayOfWeek - dayOfWeek;
      if (daysUntil <= 0) daysUntil += 7;
      
      const date = new Date(now);
      date.setDate(date.getDate() + daysUntil);
      
      nextTrainings.push({
        scheduleId: s._id.toString(),
        groupId: s.groupId,
        date: date.toISOString().split('T')[0],
        startTime: s.startTime,
        endTime: s.endTime,
        dayOfWeek: s.dayOfWeek,
      });
    }

    return nextTrainings.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
  }

  async getLocations() {
    const locations = await this.locationModel.find().limit(10);
    return locations.map(l => ({
      id: l._id.toString(),
      name: l.name,
      address: l.address,
      city: l.city,
      district: l.district,
    }));
  }

  async getGroups() {
    const groups = await this.groupModel.find().populate('locationId').limit(10);
    return groups.map(g => ({
      id: g._id.toString(),
      name: g.name,
      ageRange: g.ageRange,
      level: g.level,
      description: g.description,
    }));
  }
}
