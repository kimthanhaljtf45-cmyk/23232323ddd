import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  getThreads(@CurrentUser() user: any) {
    return this.messagesService.getThreads(user.id);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.getThread(id, user.id);
  }

  @Post('threads/:id/send')
  sendMessage(
    @Param('id') threadId: string,
    @Body() body: { text: string; type?: string },
    @CurrentUser() user: any,
  ) {
    return this.messagesService.sendMessage(
      threadId,
      user.id,
      body.text,
      body.type || 'text',
    );
  }

  @Post('threads/create')
  createThread(
    @Body() body: { coachId: string; childId?: string },
    @CurrentUser() user: any,
  ) {
    return this.messagesService.createThread(user.id, body.coachId, body.childId);
  }
}
