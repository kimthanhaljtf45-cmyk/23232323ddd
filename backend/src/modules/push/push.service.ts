import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { DeviceToken, DeviceTokenDocument } from '../../schemas/device-token.schema';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';

interface ExpoPushMessage {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  private readonly EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

  constructor(
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceTokenDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * Register a device push token for a user
   */
  async registerToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean }> {
    try {
      // Validate Expo push token format
      if (!this.isValidExpoPushToken(token)) {
        this.logger.warn(`Invalid push token format for user ${userId}: ${token}`);
        return { success: false };
      }

      // Update or insert token
      await this.deviceTokenModel.updateOne(
        { userId, token },
        {
          $set: { isActive: true, platform, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      this.logger.log(`Registered push token for user ${userId} on ${platform}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error registering token: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterToken(userId: string, token: string): Promise<{ success: boolean }> {
    try {
      await this.deviceTokenModel.updateOne(
        { userId, token },
        { $set: { isActive: false } },
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Error unregistering token: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId: string): Promise<string[]> {
    const tokens = await this.deviceTokenModel.find({
      userId,
      isActive: true,
    });
    return tokens.map((t) => t.token);
  }

  /**
   * Send push notification to a single user
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: {
      sound?: 'default' | null;
      priority?: 'default' | 'normal' | 'high';
      channelId?: string;
      badge?: number;
    },
  ): Promise<{ sent: number; failed: number }> {
    const tokens = await this.getUserTokens(userId);

    if (tokens.length === 0) {
      this.logger.debug(`No push tokens found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: options?.sound ?? 'default',
      title,
      body,
      data: {
        ...data,
        userId,
        timestamp: new Date().toISOString(),
      },
      priority: options?.priority ?? 'high',
      channelId: options?.channelId ?? 'default',
      badge: options?.badge,
    }));

    return this.sendPushNotifications(messages);
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<{ sent: number; failed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    // Collect all tokens
    const allMessages: ExpoPushMessage[] = [];

    for (const userId of userIds) {
      const tokens = await this.getUserTokens(userId);
      for (const token of tokens) {
        allMessages.push({
          to: token,
          sound: 'default',
          title,
          body,
          data: {
            ...data,
            userId,
            timestamp: new Date().toISOString(),
          },
          priority: 'high',
        });
      }
    }

    if (allMessages.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Send in batches of 100
    const results = await this.sendPushNotifications(allMessages);
    return results;
  }

  /**
   * Send push notifications (batched, max 100 per request)
   */
  private async sendPushNotifications(
    messages: ExpoPushMessage[],
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Batch into groups of 100 (Expo limit)
    const batches: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      batches.push(messages.slice(i, i + 100));
    }

    for (const batch of batches) {
      try {
        const response = await axios.post<{ data: ExpoPushTicket[] }>(
          this.EXPO_PUSH_URL,
          batch,
          {
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        );

        const tickets = response.data.data;

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'ok') {
            sent++;
            this.logger.debug(`Push sent successfully: ${ticket.id}`);
          } else {
            failed++;
            this.logger.warn(`Push failed: ${ticket.message}, error: ${ticket.details?.error}`);

            // Handle invalid tokens - mark as inactive
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await this.deviceTokenModel.updateOne(
                { token: batch[i].to },
                { $set: { isActive: false } },
              );
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error sending push batch: ${error.message}`);
        failed += batch.length;
      }
    }

    this.logger.log(`Push notification results: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  }

  /**
   * Validate Expo push token format
   */
  private isValidExpoPushToken(token: string): boolean {
    // Expo push tokens start with "ExponentPushToken["
    return (
      token.startsWith('ExponentPushToken[') && token.endsWith(']') ||
      // Also accept FCM/APNs tokens that start with other prefixes
      token.length > 20
    );
  }

  /**
   * Send alert notification to user
   */
  async sendAlert(
    userId: string,
    alertType: string,
    title: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Save notification to DB
    const notification = await this.notificationModel.create({
      userId,
      type: alertType,
      title,
      body,
      data: metadata || {},
      isRead: false,
    });

    // Send push
    await this.sendToUser(userId, title, body, {
      type: alertType,
      notificationId: notification._id.toString(),
      ...metadata,
    });
  }

  /**
   * Send payment reminder push
   */
  async sendPaymentReminder(
    userId: string,
    amount: number,
    currency: string,
    dueDate: string,
    invoiceId?: string,
  ): Promise<void> {
    await this.sendAlert(
      userId,
      'PAYMENT_REMINDER',
      'Нагадування про оплату',
      `Необхідно оплатити ${amount} ${currency}. Термін: ${dueDate}`,
      {
        invoiceId,
        amount,
        currency,
        dueDate,
        action: 'open_payments',
        screen: '/payments',
      },
    );
  }

  /**
   * Send message notification push
   */
  async sendMessageNotification(
    userId: string,
    senderName: string,
    messagePreview: string,
    threadId: string,
  ): Promise<void> {
    await this.sendAlert(
      userId,
      'NEW_MESSAGE',
      `Повідомлення від ${senderName}`,
      messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview,
      {
        threadId,
        senderName,
        action: 'open_thread',
        screen: '/messages',
        params: { id: threadId },
      },
    );
  }

  /**
   * Send attendance alert push
   */
  async sendAttendanceAlert(
    userId: string,
    childName: string,
    alertType: 'ABSENCE' | 'STREAK' | 'LOW_ATTENDANCE',
    details: string,
    childId: string,
  ): Promise<void> {
    const titles = {
      ABSENCE: 'Відсутність на тренуванні',
      STREAK: 'Серія пропусків',
      LOW_ATTENDANCE: 'Низька відвідуваність',
    };

    await this.sendAlert(
      userId,
      `ATTENDANCE_${alertType}`,
      titles[alertType],
      `${childName}: ${details}`,
      {
        childId,
        childName,
        alertType,
        action: 'open_child',
        screen: '/child',
        params: { id: childId },
      },
    );
  }

  /**
   * Send belt ready notification
   */
  async sendBeltReadyNotification(
    userId: string,
    childName: string,
    currentBelt: string,
    nextBelt: string,
    childId: string,
  ): Promise<void> {
    await this.sendAlert(
      userId,
      'BELT_READY',
      '🥋 Готовність до атестації!',
      `${childName} готовий до переходу з ${currentBelt} на ${nextBelt} пояс!`,
      {
        childId,
        childName,
        currentBelt,
        nextBelt,
        action: 'open_child',
        screen: '/child',
        params: { id: childId },
      },
    );
  }

  /**
   * Send coach action notification
   */
  async sendCoachActionNotification(
    coachId: string,
    actionType: string,
    title: string,
    body: string,
    actionId?: string,
  ): Promise<void> {
    await this.sendAlert(coachId, `COACH_ACTION_${actionType}`, title, body, {
      actionId,
      actionType,
      action: 'open_coach_actions',
      screen: '/coach/actions',
    });
  }
}
