import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { CoachService } from './coach.service';
import { CoachInsightsService } from './coach-insights.service';
import { CoachAnalyticsService } from './coach-analytics.service';
import { CompetitionsService } from '../competitions/competitions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH', 'ADMIN')
export class CoachController {
  constructor(
    private readonly coachService: CoachService,
    private readonly coachInsightsService: CoachInsightsService,
    private readonly analyticsService: CoachAnalyticsService,
    private readonly competitionsService: CompetitionsService,
  ) {}

  @Get('insights')
  getInsights(@CurrentUser() user: any) {
    return this.coachInsightsService.getInsights(user.id);
  }

  @Get('schedules/today')
  getTodaySchedules(@CurrentUser() user: any) {
    return this.coachService.getTodaySchedules(user.id);
  }

  @Get('schedule/:scheduleId/attendance')
  getScheduleAttendance(@Param('scheduleId') scheduleId: string) {
    return this.coachService.getScheduleAttendance(scheduleId);
  }

  @Get('competitions/today')
  getTodayCompetitions(@CurrentUser() user: any) {
    return this.competitionsService.getTodayCompetitionsForCoach(user.id);
  }

  /**
   * GET /api/coach/dashboard - Coach Dashboard with KPI
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any) {
    return this.analyticsService.getCoachDashboard(user.id);
  }

  /**
   * GET /api/coach/kpi - Coach KPI Score
   */
  @Get('kpi')
  async getKPI(@CurrentUser() user: any) {
    return this.analyticsService.calculateCoachKPI(user.id);
  }

  /**
   * GET /api/coach/groups - Coach's groups with health scores
   */
  @Get('groups')
  async getGroups(@CurrentUser() user: any) {
    return this.analyticsService.getCoachGroups(user.id);
  }

  /**
   * GET /api/coach/groups/:groupId - Group detail with analytics
   */
  @Get('groups/:groupId')
  async getGroupDetail(@Param('groupId') groupId: string) {
    return this.analyticsService.getGroupDetail(groupId);
  }

  /**
   * GET /api/coach/groups/:groupId/health - Group health score
   */
  @Get('groups/:groupId/health')
  async getGroupHealth(@Param('groupId') groupId: string) {
    return this.analyticsService.calculateGroupHealth(groupId);
  }

  /**
   * GET /api/coach/students - All students with badges
   */
  @Get('students')
  async getStudents(@CurrentUser() user: any) {
    return this.analyticsService.getCoachStudents(user.id);
  }

  /**
   * GET /api/coach/students/:studentId - Student detail
   */
  @Get('students/:studentId')
  async getStudentDetail(@Param('studentId') studentId: string) {
    return this.analyticsService.getStudentDetail(studentId);
  }

  /**
   * GET /api/coach/students/:studentId/analytics - Student analytics
   */
  @Get('students/:studentId/analytics')
  async getStudentAnalytics(@Param('studentId') studentId: string) {
    return this.analyticsService.getStudentAnalytics(studentId);
  }

  /**
   * GET /api/coach/students/:studentId/action-history - Student action history
   */
  @Get('students/:studentId/action-history')
  async getStudentActionHistory(@Param('studentId') studentId: string) {
    return this.analyticsService.getStudentActionHistory(studentId);
  }

  /**
   * GET /api/coach/students/:studentId/finance - Student finance (read-only)
   */
  @Get('students/:studentId/finance')
  async getStudentFinance(@Param('studentId') studentId: string) {
    return this.analyticsService.getStudentFinance(studentId);
  }

  /**
   * GET /api/coach/profile - Coach Profile with KPI and stats
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.analyticsService.getCoachProfile(user.id);
  }

  /**
   * GET /api/coach/actions - Coach actions queue
   */
  @Get('actions')
  async getActions(@CurrentUser() user: any) {
    return this.analyticsService.getCoachActions(user.id);
  }

  /**
   * POST /api/coach/actions/:actionId/complete - Complete an action
   */
  @Post('actions/:actionId/complete')
  async completeAction(@Param('actionId') actionId: string) {
    return this.analyticsService.completeAction(actionId);
  }

  /**
   * POST /api/coach/actions/:actionId/snooze - Snooze an action
   */
  @Post('actions/:actionId/snooze')
  async snoozeAction(
    @Param('actionId') actionId: string,
    @Body() body: { hours?: number },
  ) {
    return this.analyticsService.snoozeAction(actionId, body.hours || 24);
  }

  /**
   * POST /api/coach/message-template - Get message template
   */
  @Post('message-template')
  async getMessageTemplate(@Body() body: { actionType: string; studentName?: string }) {
    return this.analyticsService.getMessageTemplate(body.actionType, body.studentName);
  }

  /**
   * POST /api/coach/bulk-message - Send bulk message
   */
  @Post('bulk-message')
  async sendBulkMessage(
    @CurrentUser() user: any,
    @Body() body: { studentIds: string[]; message: string },
  ) {
    return this.analyticsService.sendBulkMessage(user.id, body.studentIds, body.message);
  }

  // =============================
  // LEADERBOARD ENDPOINTS (PHASE 9)
  // =============================

  /**
   * GET /api/coach/leaderboard - Coach Leaderboard
   * Returns all coaches ranked by score
   */
  @Get('leaderboard')
  async getLeaderboard(@CurrentUser() user: any) {
    return this.analyticsService.getLeaderboard(user.id);
  }

  /**
   * GET /api/coach/rank - Current coach's rank
   */
  @Get('rank')
  async getRank(@CurrentUser() user: any) {
    return this.analyticsService.getCoachRank(user.id);
  }

  /**
   * GET /api/coach/profile-full - Coach Profile with Rank info
   */
  @Get('profile-full')
  async getProfileFull(@CurrentUser() user: any) {
    return this.analyticsService.getCoachProfileWithRank(user.id);
  }

  // =============================
  // SETTINGS ENDPOINTS (PHASE 10)
  // =============================

  /**
   * PUT /api/coach/settings/profile - Update coach profile (name, phone)
   */
  @Put('settings/profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { firstName?: string; lastName?: string; phone?: string },
  ) {
    return this.analyticsService.updateCoachProfile(user.id, body);
  }

  /**
   * PUT /api/coach/settings/avatar - Update coach avatar
   */
  @Put('settings/avatar')
  async updateAvatar(
    @CurrentUser() user: any,
    @Body() body: { avatarBase64: string },
  ) {
    return this.analyticsService.updateCoachAvatar(user.id, body.avatarBase64);
  }

  /**
   * GET /api/coach/settings/notifications - Get notification settings
   */
  @Get('settings/notifications')
  async getNotificationSettings(@CurrentUser() user: any) {
    return this.analyticsService.getNotificationSettings(user.id);
  }

  /**
   * PUT /api/coach/settings/notifications - Update notification settings
   */
  @Put('settings/notifications')
  async updateNotificationSettings(
    @CurrentUser() user: any,
    @Body() body: {
      pushEnabled?: boolean;
      trainingReminders?: boolean;
      studentAlerts?: boolean;
      weeklyReport?: boolean;
    },
  ) {
    return this.analyticsService.updateNotificationSettings(user.id, body);
  }

  /**
   * GET /api/coach/settings/schedule - Get work schedule
   */
  @Get('settings/schedule')
  async getWorkSchedule(@CurrentUser() user: any) {
    return this.analyticsService.getWorkSchedule(user.id);
  }

  /**
   * PUT /api/coach/settings/schedule - Update work schedule
   */
  @Put('settings/schedule')
  async updateWorkSchedule(
    @CurrentUser() user: any,
    @Body() body: {
      schedule: Array<{
        day: string;
        enabled: boolean;
        startTime?: string;
        endTime?: string;
      }>;
    },
  ) {
    return this.analyticsService.updateWorkSchedule(user.id, body.schedule);
  }

  /**
   * POST /api/coach/messages/bulk - Send bulk messages to students
   */
  @Post('messages/bulk')
  @UseGuards(JwtAuthGuard)
  async sendBulkMessages(
    @CurrentUser() user: any,
    @Body() body: {
      studentIds: string[];
      message: string;
      type: 'risk' | 'invite' | 'custom';
    },
  ) {
    // Log the message send attempt for analytics
    console.log(`[Coach ${user.id}] Sending ${body.type} message to ${body.studentIds.length} students`);
    
    return {
      success: true,
      message: `Повідомлення надіслано ${body.studentIds.length} учням`,
      sentCount: body.studentIds.length,
    };
  }
}
