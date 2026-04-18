import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  findAll() {
    return this.scheduleService.findAll();
  }

  @Get('coach/today')
  getCoachTodaySchedule(@CurrentUser() user: any) {
    return this.scheduleService.getCoachTodaySchedule(user.id);
  }

  @Get('upcoming')
  getUpcoming(@CurrentUser() user: any) {
    return this.scheduleService.getUpcomingSchedule(user.id, user.role);
  }

  @Get('group/:groupId')
  getGroupSchedule(@Param('groupId') groupId: string) {
    return this.scheduleService.getGroupSchedule(groupId);
  }
}
