import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';
import { DeviceToken, DeviceTokenDocument } from '../../schemas/device-token.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceTokenDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(ParentChild.name)
    private readonly parentChildModel: Model<ParentChildDocument>,
  ) {}

  async notifyUser(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const notification = await this.notificationModel.create({
      userId,
      type,
      title,
      body,
      data: data || {},
      isRead: false,
    });

    // Get device tokens for push (stubbed for now)
    const tokens = await this.deviceTokenModel.find({ userId, isActive: true });
    if (tokens.length > 0) {
      console.log(`[PUSH] Would send to ${tokens.length} devices: ${title}`);
    }

    return notification;
  }

  /**
   * P0.5 FIX: Notify ALL parents linked to child (not just one)
   */
  async notifyAbsence(childId: string, date: string) {
    const child = await this.childModel.findById(childId);
    if (!child) return;

    // Find ALL parent links for this child
    const parentLinks = await this.parentChildModel.find({ childId });
    if (parentLinks.length === 0) return;

    const childName = `${child.firstName} ${child.lastName || ''}`.trim();

    // Notify each parent
    for (const link of parentLinks) {
      await this.notifyUser(
        link.parentId,
        'ABSENCE_MARKED',
        'Відсутність',
        `${childName} відмічено як відсутнього ${date}`,
        { childId, date, action: 'open_child', screen: '/child', params: { id: childId } },
      );
    }
  }

  async getUserNotifications(userId: string, limit = 50) {
    const notifications = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      isRead: n.isRead,
      createdAt: (n as any).createdAt,
    }));
  }

  async getUnreadCount(userId: string) {
    return this.notificationModel.countDocuments({ userId, isRead: false });
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await this.notificationModel.updateOne(
      { _id: notificationId, userId },
      { $set: { isRead: true } },
    );
    return result.modifiedCount > 0;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    );
    return result.modifiedCount;
  }

  async registerDevice(userId: string, token: string, platform: string) {
    await this.deviceTokenModel.updateOne(
      { userId, token },
      {
        $set: { isActive: true, platform },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return { success: true };
  }
}
