import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ControlSystemService } from './control-system.service';

@Controller('control-system')
@UseGuards(JwtAuthGuard)
export class ControlSystemController {
  constructor(private readonly controlService: ControlSystemService) {}

  // ==================== GROUP HEALTH ====================

  @Get('groups/health')
  async getAllGroupsHealth(@Request() req) {
    const tenantId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.tenantId;
    return this.controlService.getAllGroupsHealth(tenantId);
  }

  @Get('groups/critical')
  async getCriticalGroups(@Request() req) {
    const tenantId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.tenantId;
    return this.controlService.getCriticalGroups(tenantId);
  }

  @Get('groups/:groupId/health')
  async getGroupHealth(@Param('groupId') groupId: string) {
    return this.controlService.getGroupHealth(groupId);
  }

  @Post('groups/:groupId/recalculate')
  async recalculateGroupHealth(@Param('groupId') groupId: string) {
    return this.controlService.calculateGroupHealth(groupId);
  }

  // ==================== COACH PERFORMANCE ====================

  @Get('coaches/leaderboard')
  async getCoachLeaderboard(@Request() req) {
    const tenantId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.tenantId;
    return this.controlService.getCoachLeaderboard(tenantId);
  }

  @Get('coaches/at-risk')
  async getAtRiskCoaches(@Request() req) {
    const tenantId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.tenantId;
    return this.controlService.getAtRiskCoaches(tenantId);
  }

  @Get('coaches/:coachId/performance')
  async getCoachPerformance(@Param('coachId') coachId: string) {
    return this.controlService.getCoachPerformance(coachId);
  }

  @Post('coaches/:coachId/recalculate')
  async recalculateCoachPerformance(@Param('coachId') coachId: string) {
    return this.controlService.calculateCoachPerformance(coachId);
  }

  // ==================== CLUB HEALTH ====================

  @Get('clubs/all')
  async getAllClubsHealth(@Request() req) {
    if (req.user.role !== 'SUPER_ADMIN') {
      return { error: 'Super admin only' };
    }
    return this.controlService.getAllClubsHealth();
  }

  @Get('clubs/:tenantId/health')
  async getClubHealth(@Param('tenantId') tenantId: string) {
    return this.controlService.getClubHealth(tenantId);
  }

  @Post('clubs/:tenantId/recalculate')
  async recalculateClubHealth(@Param('tenantId') tenantId: string) {
    return this.controlService.calculateClubHealth(tenantId);
  }

  // ==================== SUPER ADMIN ====================

  @Get('super-admin/overview')
  async getSuperAdminOverview(@Request() req) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      return { error: 'Admin only' };
    }
    return this.controlService.getSuperAdminOverview();
  }

  // ==================== RECALCULATE ALL ====================

  @Post('recalculate-all')
  async recalculateAll(@Request() req) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      return { error: 'Admin only' };
    }
    return this.controlService.recalculateAll();
  }
}
