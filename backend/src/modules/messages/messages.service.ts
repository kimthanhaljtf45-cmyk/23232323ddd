import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageThread, MessageThreadDocument } from '../../schemas/message-thread.schema';
import { Message, MessageDocument } from '../../schemas/message.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(MessageThread.name)
    private readonly threadModel: Model<MessageThreadDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async getThreads(userId: string) {
    const threads = await this.threadModel.find({
      $or: [{ parentId: userId }, { coachId: userId }],
    }).sort({ lastMessageAt: -1 });

    const result = [];
    for (const thread of threads) {
      const threadData = this.serialize(thread);

      const otherId = thread.parentId === userId ? thread.coachId : thread.parentId;
      const otherUser = await this.userModel.findById(otherId);
      threadData.otherUser = this.serialize(otherUser);

      const unreadCount = await this.messageModel.countDocuments({
        threadId: thread._id.toString(),
        receiverId: userId,
        isRead: false,
      });
      threadData.unreadCount = unreadCount;

      result.push(threadData);
    }

    return result;
  }

  async getThread(threadId: string, userId: string) {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.messageModel
      .find({ threadId })
      .sort({ createdAt: 1 });

    // Mark as read
    await this.messageModel.updateMany(
      { threadId, receiverId: userId, isRead: false },
      { $set: { isRead: true } },
    );

    return {
      thread: this.serialize(thread),
      messages: messages.map((m) => this.serialize(m)),
    };
  }

  async sendMessage(
    threadId: string,
    senderId: string,
    text: string,
    type: string = 'text',
  ) {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const receiverId = thread.parentId === senderId ? thread.coachId : thread.parentId;

    const message = await this.messageModel.create({
      threadId,
      senderId,
      receiverId,
      type,
      text,
      isRead: false,
    });

    // Update thread
    await this.threadModel.updateOne(
      { _id: threadId },
      {
        $set: {
          lastMessage: text.substring(0, 100),
          lastMessageAt: new Date(),
        },
      },
    );

    // Notify receiver
    const sender = await this.userModel.findById(senderId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName || ''}`.trim() : 'Користувач';

    await this.notificationsService.notifyUser(
      receiverId,
      'NEW_MESSAGE',
      'Нове повідомлення',
      `${senderName}: ${text.substring(0, 50)}...`,
      { threadId, action: 'open_thread', screen: '/messages', params: { id: threadId } },
    );

    return this.serialize(message);
  }

  async createThread(parentId: string, coachId: string, childId?: string) {
    // Check if thread exists
    let thread = await this.threadModel.findOne({ parentId, coachId });

    if (!thread) {
      thread = await this.threadModel.create({
        parentId,
        coachId,
        childId,
      });
    }

    return this.serialize(thread);
  }
}
