import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}

  /**
   * GET /api/communication/threads
   * Get all threads for the current user
   */
  @Get('threads')
  getThreads(@CurrentUser() user: any) {
    return this.service.getThreads(user.id);
  }

  /**
   * GET /api/communication/threads/:id/messages
   * Get messages in a thread
   */
  @Get('threads/:id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getMessages(id, user.id);
  }

  /**
   * POST /api/communication/threads
   * Create or get a thread between participants
   */
  @Post('threads')
  createThread(@CurrentUser() user: any, @Body() body: {
    participantId: string;
    childId?: string;
    groupId?: string;
  }) {
    return this.service.getOrCreateThread(
      [user.id, body.participantId],
      body.childId,
      body.groupId,
    );
  }

  /**
   * POST /api/communication/messages
   * Send a message
   */
  @Post('messages')
  sendMessage(@CurrentUser() user: any, @Body() body: {
    threadId: string;
    text: string;
  }) {
    return this.service.sendMessage({
      threadId: body.threadId,
      senderId: user.id,
      text: body.text,
    });
  }

  /**
   * POST /api/communication/messages/system
   * Send a system message (admin/coach action)
   */
  @Post('messages/system')
  sendSystemMessage(@CurrentUser() user: any, @Body() body: {
    participantId: string;
    text: string;
    action: string;
    childId?: string;
    invoiceId?: string;
  }) {
    return this.service.sendSystemMessage({
      participants: [user.id, body.participantId],
      text: body.text,
      relatedChildId: body.childId,
      meta: {
        action: body.action,
        childId: body.childId,
        invoiceId: body.invoiceId,
      },
    });
  }

  /**
   * POST /api/communication/remind-payment
   * Quick action: remind parent about payment for a student
   */
  @Post('remind-payment')
  remindPayment(@CurrentUser() user: any, @Body() body: { childId: string }) {
    return this.service.remindPayment(user.id, body.childId);
  }

  /**
   * POST /api/communication/threads/:id/read
   * Mark all messages in thread as read
   */
  @Post('threads/:id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markThreadAsRead(id, user.id);
  }

  /**
   * GET /api/communication/unread
   * Get unread message count
   */
  @Get('unread')
  getUnreadCount(@CurrentUser() user: any) {
    return this.service.getUnreadCount(user.id).then(count => ({ count }));
  }
}
