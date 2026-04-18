import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarkAttendanceDto, ReportAbsenceDto } from './dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('mark')
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.mark(dto, user.id);
  }

  @Post('report-absence')
  reportAbsence(@Body() dto: ReportAbsenceDto, @CurrentUser() user: any) {
    return this.attendanceService.reportAbsence(dto, user.id);
  }

  @Get('child/:childId')
  getForChild(@Param('childId') childId: string) {
    return this.attendanceService.getForChild(childId);
  }
}
