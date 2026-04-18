import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Thread, ThreadDocument } from '../../schemas/thread.schema';
import { CommunicationMessage, CommunicationMessageDocument } from '../../schemas/communication-message.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Thread.name) private threadModel: Model<ThreadDocument>,
    @InjectModel(CommunicationMessage.name) private messageModel: Model<CommunicationMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
  ) {}

  // ==================== THREADS ====================

  /**
   * Get or create a direct thread between participants
   * Deduplicates by sorting participant IDs
   */
  async getOrCreateThread(
    participants: string[],
    relatedChildId?: string,
    relatedGroupId?: string,
  ): Promise<any> {
    const sorted = [...participants].sort();

    // Find existing thread with same participants
    const existing = await this.threadModel.findOne({
      participants: { $all: sorted, $size: sorted.length },
      ...(relatedChildId ? { relatedChildId } : {}),
    });

    if (existing) {
      return this.serializeThread(existing);
    }

    const thread = await this.threadModel.create({
      type: 'DIRECT',
      participants: sorted,
      relatedChildId,
      relatedGroupId,
      lastMessageAt: new Date(),
    });

    return this.serializeThread(thread);
  }

  /**
   * Get all threads for a user with enriched data
   */
  async getThreads(userId: string): Promise<any[]> {
    const threads = await this.threadModel
      .find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .lean();

    const result = [];
    for (const thread of threads) {
      // Get other participant(s) info
      const otherIds = thread.participants.filter(p => p !== userId && p !== 'SYSTEM');
      
      // Filter valid ObjectIds to prevent CastError
      const validIds = otherIds.filter(id => {
        try {
          return id && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
      
      const otherUsers = validIds.length > 0 
        ? await this.userModel.find({ _id: { $in: validIds } }).lean()
        : [];

      // Unread count
      const unreadCount = await this.messageModel.countDocuments({
        threadId: thread._id.toString(),
        readBy: { $ne: userId },
        senderId: { $ne: userId },
      });

      // Related child info
      let childInfo = null;
      if (thread.relatedChildId) {
        const child = await this.childModel.findById(thread.relatedChildId).lean();
        if (child) {
          childInfo = {
            id: child._id.toString(),
            name: `${child.firstName} ${child.lastName || ''}`.trim(),
          };
        }
      }

      result.push({
        id: thread._id.toString(),
        type: thread.type,
        participants: otherUsers.map(u => ({
          id: u._id.toString(),
          name: `${u.firstName} ${u.lastName || ''}`.trim(),
          role: u.role,
          avatarUrl: u.avatarUrl,
        })),
        relatedChild: childInfo,
        lastMessage: thread.lastMessage,
        lastMessageAt: thread.lastMessageAt,
        unreadCount,
      });
    }

    return result;
  }

  // ==================== MESSAGES ====================

  /**
   * Get messages for a thread
   */
  async getMessages(threadId: string, userId: string, limit = 100): Promise<any[]> {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) throw new NotFoundException('Thread not found');

    // Verify user is participant
    if (!thread.participants.includes(userId)) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.messageModel
      .find({ threadId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    // Mark messages as read
    await this.messageModel.updateMany(
      {
        threadId,
        senderId: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } },
    );

    // Enrich with sender info
    const senderIds = [...new Set(messages.map(m => m.senderId).filter(id => id !== 'SYSTEM'))];
    const senders = await this.userModel.find({ _id: { $in: senderIds } }).lean();
    const senderMap = new Map(senders.map(s => [s._id.toString(), s]));

    return messages.map(m => {
      const sender = senderMap.get(m.senderId);
      return {
        id: m._id.toString(),
        threadId: m.threadId,
        senderId: m.senderId,
        senderName: m.senderId === 'SYSTEM' ? 'Система' : sender ? `${sender.firstName} ${sender.lastName || ''}`.trim() : 'Unknown',
        senderRole: m.senderId === 'SYSTEM' ? 'SYSTEM' : sender?.role,
        text: m.text,
        type: m.type,
        meta: m.meta,
        readBy: m.readBy,
        createdAt: (m as any).createdAt,
      };
    });
  }

  /**
   * Send a text message
   */
  async sendMessage(data: {
    threadId: string;
    senderId: string;
    text: string;
    type?: 'TEXT' | 'SYSTEM';
    meta?: any;
  }): Promise<any> {
    const thread = await this.threadModel.findById(data.threadId);
    if (!thread) throw new NotFoundException('Thread not found');

    const message = await this.messageModel.create({
      threadId: data.threadId,
      senderId: data.senderId,
      text: data.text,
      type: data.type || 'TEXT',
      meta: data.meta,
      readBy: [data.senderId],
    });

    // Update thread
    await this.threadModel.updateOne(
      { _id: data.threadId },
      {
        lastMessage: data.text.substring(0, 100),
        lastMessageAt: new Date(),
      },
    );

    return {
      id: message._id.toString(),
      threadId: message.threadId,
      senderId: message.senderId,
      text: message.text,
      type: message.type,
      meta: message.meta,
      createdAt: (message as any).createdAt,
    };
  }

  // ==================== SYSTEM MESSAGES (KEY INTEGRATION) ====================

  /**
   * Send a system message — used by RetentionEngine, BillingService, etc.
   * Automatically creates thread if needed
   */
  async sendSystemMessage(data: {
    participants: string[];
    text: string;
    meta?: {
      action?: string;
      childId?: string;
      invoiceId?: string;
      groupId?: string;
    };
    relatedChildId?: string;
  }): Promise<any> {
    const thread = await this.getOrCreateThread(
      data.participants,
      data.relatedChildId,
    );

    return this.sendMessage({
      threadId: thread.id,
      senderId: 'SYSTEM',
      text: data.text,
      type: 'SYSTEM',
      meta: data.meta,
    });
  }

  /**
   * Quick action: Coach reminds parent about payment
   */
  async remindPayment(coachId: string, childId: string): Promise<any> {
    const child = await this.childModel.findById(childId);
    if (!child) throw new NotFoundException('Child not found');

    // Find parent via ParentChild
    const parentLink = await this.parentChildModel.findOne({ childId });
    if (!parentLink) throw new NotFoundException('Parent not found for child');

    const childName = `${child.firstName} ${child.lastName || ''}`.trim();

    return this.sendSystemMessage({
      participants: [coachId, parentLink.parentId],
      relatedChildId: childId,
      text: `Нагадування про оплату за ${childName}`,
      meta: {
        action: 'PAYMENT_REMINDER',
        childId,
      },
    });
  }

  /**
   * Quick action: Notify about absence
   */
  async notifyAbsence(coachId: string, childId: string, date: string): Promise<any> {
    const child = await this.childModel.findById(childId);
    if (!child) throw new NotFoundException('Child not found');

    const parentLink = await this.parentChildModel.findOne({ childId });
    if (!parentLink) return null;

    const childName = `${child.firstName} ${child.lastName || ''}`.trim();

    return this.sendSystemMessage({
      participants: [coachId, parentLink.parentId],
      relatedChildId: childId,
      text: `${childName} відсутній на тренуванні ${date}`,
      meta: {
        action: 'ABSENCE',
        childId,
      },
    });
  }

  /**
   * Quick action: Retention risk alert
   */
  async sendRetentionAlert(adminId: string, parentId: string, childId: string, riskLevel: string): Promise<any> {
    const child = await this.childModel.findById(childId);
    const childName = child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Учень';

    return this.sendSystemMessage({
      participants: [adminId, parentId],
      relatedChildId: childId,
      text: `Увага: ${childName} має ризик відтоку (${riskLevel}). Рекомендуємо зв'язатися.`,
      meta: {
        action: 'RETENTION',
        childId,
      },
    });
  }

  // ==================== UNREAD COUNT ====================

  async getUnreadCount(userId: string): Promise<number> {
    // Get all threads for user
    const threads = await this.threadModel.find({ participants: userId }).lean();
    const threadIds = threads.map(t => t._id.toString());

    return this.messageModel.countDocuments({
      threadId: { $in: threadIds },
      senderId: { $ne: userId },
      readBy: { $ne: userId },
    });
  }

  // ==================== MARK AS READ ====================

  async markThreadAsRead(threadId: string, userId: string): Promise<{ success: boolean }> {
    await this.messageModel.updateMany(
      {
        threadId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } },
    );
    return { success: true };
  }

  // ==================== HELPERS ====================

  /**
   * Get parent for a student (for coach use)
   */
  async getParentForStudent(childId: string): Promise<string | null> {
    const link = await this.parentChildModel.findOne({ childId });
    return link?.parentId || null;
  }

  private serializeThread(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      id: obj._id.toString(),
      type: obj.type,
      participants: obj.participants,
      relatedChildId: obj.relatedChildId,
      relatedGroupId: obj.relatedGroupId,
      lastMessage: obj.lastMessage,
      lastMessageAt: obj.lastMessageAt,
    };
  }
}
