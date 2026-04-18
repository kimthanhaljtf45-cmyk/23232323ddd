import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StudentCabinetService } from './student-cabinet.service';

@Controller('student')
@UseGuards(JwtAuthGuard)
export class StudentCabinetController {
  constructor(private readonly service: StudentCabinetService) {}

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.service.getDashboard(req.user.sub || req.user.id);
  }

  @Get('schedule')
  async getSchedule(@Request() req: any) {
    return this.service.getSchedule(req.user.sub || req.user.id);
  }

  @Get('attendance')
  async getAttendance(@Request() req: any) {
    return this.service.getAttendance(req.user.sub || req.user.id);
  }

  @Get('progress')
  async getProgress(@Request() req: any) {
    return this.service.getProgress(req.user.sub || req.user.id);
  }

  @Get('subscription')
  async getSubscription(@Request() req: any) {
    return this.service.getSubscription(req.user.sub || req.user.id);
  }

  @Get('finance')
  async getFinance(@Request() req: any) {
    return this.service.getFinance(req.user.sub || req.user.id);
  }

  @Get('competitions')
  async getCompetitions(@Request() req: any) {
    return this.service.getCompetitions(req.user.sub || req.user.id);
  }
}
