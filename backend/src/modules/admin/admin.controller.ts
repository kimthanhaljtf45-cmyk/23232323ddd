import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OWNER')
export class AdminController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly analyticsService: AdminAnalyticsService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.dashboardService.getDashboard();
  }

  @Get('analytics')
  getAnalytics() {
    return this.analyticsService.getAnalytics();
  }

  // ==================== GROUPS ====================
  // P1 FIX: Group management moved to AdminGroupsController (single source of truth)
  // AdminGroupsModule handles: create, update, delete, assign-coach, assign-students, move-student
  // with proper cascade updates (coachId on children, coachProfile updates, capacity checks)

  // ==================== COACHES ====================
  
  @Get('coaches')
  getCoaches() {
    return this.dashboardService.getCoaches();
  }

  // ==================== LOCATIONS ====================
  
  @Get('locations')
  getLocations() {
    return this.dashboardService.getLocations();
  }

  // ==================== STUDENTS ====================

  @Get('payments')
  getPayments(@Query('status') status?: string) {
    return this.dashboardService.getPayments(status);
  }

  @Get('students')
  getStudents(
    @Query('groupId') groupId?: string,
    @Query('belt') belt?: string,
    @Query('lowAttendance') lowAttendance?: string,
  ) {
    return this.dashboardService.getStudents({
      groupId,
      belt,
      lowAttendance: lowAttendance === 'true',
    });
  }

  @Get('students/available')
  getAvailableStudents() {
    return this.dashboardService.getAvailableStudents();
  }

  // ==================== BRANCHES (Locations as Branches) ====================

  @Post('branches')
  createBranch(@Body() dto: { name: string; address?: string; city?: string; district?: string }) {
    return this.dashboardService.createBranch(dto);
  }

  @Get('branches')
  getBranches() {
    return this.dashboardService.getBranches();
  }

  @Patch('branches/:id')
  updateBranch(@Param('id') id: string, @Body() dto: { name?: string; address?: string; status?: string }) {
    return this.dashboardService.updateBranch(id, dto);
  }

  @Delete('branches/:id')
  deleteBranch(@Param('id') id: string) {
    return this.dashboardService.deleteBranch(id);
  }

  // ==================== FINANCE ====================

  @Get('finance/overview')
  getFinanceOverview() {
    return this.dashboardService.getFinanceOverview();
  }

  @Get('finance/debts')
  getFinanceDebts() {
    return this.dashboardService.getFinanceDebts();
  }

  @Post('finance/invoices/:id/remind')
  remindInvoice(@Param('id') id: string) {
    return this.dashboardService.remindInvoice(id);
  }

  @Post('finance/invoices/:id/mark-paid')
  markInvoicePaid(@Param('id') id: string) {
    return this.dashboardService.markInvoicePaid(id);
  }

  // ==================== PARENTS ====================

  @Get('parents')
  getParents() {
    return this.dashboardService.getParents();
  }

  /**
   * P2 FIX: Admin → Parent detail page
   * GET /api/admin/parents/:id
   */
  @Get('parents/:id')
  getParentDetail(@Param('id') id: string) {
    return this.dashboardService.getParentDetail(id);
  }

  // ==================== COACHES CRUD (P2 FIX) ====================

  @Post('coaches')
  createCoach(@Body() dto: { firstName: string; lastName?: string; phone: string }) {
    return this.dashboardService.createCoach(dto);
  }

  @Patch('coaches/:id')
  updateCoach(@Param('id') id: string, @Body() dto: any) {
    return this.dashboardService.updateCoach(id, dto);
  }

  @Delete('coaches/:id')
  deleteCoach(@Param('id') id: string) {
    return this.dashboardService.deactivateCoach(id);
  }

  @Post('coaches/:id/deactivate')
  deactivateCoach(@Param('id') id: string) {
    return this.dashboardService.deactivateCoach(id);
  }

  @Get('coaches/:id/stats')
  getCoachStats(@Param('id') id: string) {
    return this.dashboardService.getCoachStats(id);
  }

  // Leaderboard moved to CoachKPIController - /api/admin/coaches/leaderboard
}
