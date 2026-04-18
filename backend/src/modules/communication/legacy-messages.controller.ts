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

/**
 * LEGACY MESSAGES CONTROLLER
 * 
 * Provides backward compatibility for old /api/messages/* routes.
 * Delegates all calls to CommunicationService (canonical messaging).
 * 
 * Old MessagesService was limited to parentId+coachId threads.
 * This controller supports ALL participant types via CommunicationService.
 */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class LegacyMessagesController {
  constructor(private readonly service: CommunicationService) {}

  @Get('threads')
  getThreads(@CurrentUser() user: any) {
    return this.service.getThreads(user.id);
  }

  @Get('threads/:id')
  async getThread(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getMessages(id, user.id);
  }

  @Post('threads/:id/send')
  sendMessage(
    @Param('id') threadId: string,
    @CurrentUser() user: any,
    @Body() body: { text: string },
  ) {
    return this.service.sendMessage({
      threadId,
      senderId: user.id,
      text: body.text,
    });
  }

  @Post('threads/create')
  createThread(
    @CurrentUser() user: any,
    @Body() body: { participantId?: string; coachId?: string; parentId?: string; childId?: string },
  ) {
    // Support both old (coachId/parentId) and new (participantId) formats
    const otherId = body.participantId || body.coachId || body.parentId;
    if (!otherId) {
      return { error: 'participantId required' };
    }
    return this.service.getOrCreateThread(
      [user.id, otherId],
      body.childId,
    );
  }

  @Get('unread')
  getUnreadCount(@CurrentUser() user: any) {
    return this.service.getUnreadCount(user.id).then(count => ({ count }));
  }
}
