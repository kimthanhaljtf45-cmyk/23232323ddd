import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CoachActionsService } from './coach-actions.service';
import { CoachActionsGenerator } from './coach-actions.generator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('coach/actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH', 'ADMIN')
export class CoachActionsController {
  constructor(
    private readonly actionsService: CoachActionsService,
    private readonly generator: CoachActionsGenerator,
  ) {}

  @Get()
  async getMyActions(@Request() req: any) {
    const coachId = req.user.sub;
    return this.actionsService.getActionsWithSummary(coachId);
  }

  @Post(':id/complete')
  async completeAction(
    @Param('id') actionId: string,
    @Request() req: any,
  ) {
    return this.actionsService.complete(actionId, req.user.sub);
  }

  @Post(':id/snooze')
  async snoozeAction(
    @Param('id') actionId: string,
    @Body('until') until: string,
  ) {
    const snoozeUntil = until ? new Date(until) : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24h
    return this.actionsService.snooze(actionId, snoozeUntil);
  }

  @Post('sync')
  async syncActions(@Request() req: any) {
    const coachId = req.user.sub;
    return this.generator.syncForCoach(coachId);
  }
}
