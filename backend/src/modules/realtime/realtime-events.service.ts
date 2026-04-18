import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeEventsService {
  constructor(
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
  ) {}

  /**
   * Push new message to thread participants
   */
  pushNewMessage(params: {
    threadId: string;
    receiverId: string;
    message: any;
    unreadCount: number;
  }) {
    // Emit to thread room
    this.gateway.emitToThread(params.threadId, 'message.new', params.message);

    // Update unread count for receiver
    this.gateway.emitToUser(params.receiverId, 'messages.unread_count', {
      unreadCount: params.unreadCount,
    });

    // Notify about thread update
    this.gateway.emitToUser(params.receiverId, 'thread.updated', {
      threadId: params.threadId,
      lastMessage: params.message,
    });
  }

  /**
   * Push notification to user
   */
  pushNotification(params: {
    userId: string;
    notification: any;
    unreadCount: number;
  }) {
    this.gateway.emitToUser(params.userId, 'notification.new', params.notification);
    this.gateway.emitToUser(params.userId, 'notifications.unread_count', {
      unreadCount: params.unreadCount,
    });
  }

  /**
   * Push absence reported event to coach
   */
  pushAbsenceReported(params: {
    coachId: string;
    groupId?: string;
    payload: any;
  }) {
    this.gateway.emitToUser(params.coachId, 'absence.reported', params.payload);

    if (params.groupId) {
      this.gateway.emitToGroup(params.groupId, 'attendance.group_progress', {
        changed: true,
      });
    }
  }

  /**
   * Push attendance update to coach and parent
   */
  pushAttendanceUpdated(params: {
    coachId?: string;
    parentId?: string;
    childId: string;
    payload: any;
  }) {
    if (params.coachId) {
      this.gateway.emitToUser(params.coachId, 'attendance.updated', params.payload);
    }

    if (params.parentId) {
      this.gateway.emitToUser(params.parentId, 'attendance.updated', params.payload);
    }
  }

  /**
   * Push admin dashboard update
   */
  pushAdminDashboardUpdate(payload: any) {
    this.gateway.emitToRole('ADMIN', 'admin.dashboard.updated', payload);
  }

  /**
   * Push smart alert to user
   */
  pushSmartAlert(params: { userId: string; alert: any }) {
    this.gateway.emitToUser(params.userId, 'alert.new', params.alert);
  }

  /**
   * Push parent insights update
   */
  pushParentInsightsUpdate(params: { parentId: string; childId: string; payload: any }) {
    this.gateway.emitToUser(params.parentId, 'insights.updated', {
      childId: params.childId,
      ...params.payload,
    });
  }

  /**
   * Push coach insights update
   */
  pushCoachInsightsUpdate(params: { coachId: string; payload: any }) {
    this.gateway.emitToUser(params.coachId, 'coach.insights.updated', params.payload);
  }
}
