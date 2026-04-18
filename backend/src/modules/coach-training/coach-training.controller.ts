import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoachTrainingService } from './coach-training.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('coach/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH')
export class CoachTrainingController {
  constructor(private readonly service: CoachTrainingService) {}

  /**
   * GET /api/coach/training/today
   * Get today's training sessions for the coach
   */
  @Get('today')
  getToday(@CurrentUser() user: any) {
    return this.service.getTodaySessions(user.id);
  }

  /**
   * GET /api/coach/training/by-date?date=2026-04-09
   * Get training sessions for a specific date
   */
  @Get('by-date')
  getByDate(@CurrentUser() user: any, @Query('date') date: string) {
    return this.service.getSessionsByDate(user.id, date);
  }

  /**
   * GET /api/coach/training/:id
   * Get full training session with students and attendance
   */
  @Get(':id')
  getSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getSession(user.id, id);
  }

  /**
   * POST /api/coach/training/ensure
   * Create or find session for group+date (auto-create)
   * Body: { groupId, date }
   */
  @Post('ensure')
  ensureSession(
    @CurrentUser() user: any,
    @Body() body: { groupId: string; date: string },
  ) {
    return this.service.ensureSession(user.id, body.groupId, body.date);
  }

  /**
   * POST /api/coach/training/:id/start
   * Start a training session
   */
  @Post(':id/start')
  startSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.startSession(user.id, id);
  }

  /**
   * POST /api/coach/training/:id/finish
   * Finish a training session
   */
  @Post(':id/finish')
  finishSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.finishSession(user.id, id);
  }

  /**
   * POST /api/coach/training/:id/attendance
   * Mark single student attendance
   * Body: { studentId, status: 'PRESENT'|'ABSENT'|'LATE', note? }
   */
  @Post(':id/attendance')
  markAttendance(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { studentId: string; status: string; note?: string },
  ) {
    return this.service.markAttendance(user.id, id, body);
  }

  /**
   * POST /api/coach/training/:id/attendance/all
   * Mark all unmarked students as present
   */
  @Post(':id/attendance/all')
  markAllPresent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markAllPresent(user.id, id);
  }
}
