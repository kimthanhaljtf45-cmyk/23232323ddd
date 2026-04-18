import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { CoachKPIService } from './coach-kpi.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/coaches')
@UseGuards(JwtAuthGuard)
export class CoachKPIController {
  constructor(private readonly kpiService: CoachKPIService) {}

  @Get('leaderboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getLeaderboard(@Request() req: any) {
    const clubId = req.clubId || req.user?.activeClubId;
    return this.kpiService.getLeaderboard(clubId);
  }

  @Get(':coachId/kpi')
  getCoachKPI(@Param('coachId') coachId: string, @Request() req: any) {
    const clubId = req.clubId || req.user?.activeClubId;
    return this.kpiService.getCoachCard(coachId, clubId);
  }

  @Post('recalculate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  recalculate(@Request() req: any) {
    const clubId = req.clubId || req.user?.activeClubId;
    return this.kpiService.recalculateAll(clubId);
  }

  @Post('leads/:leadId/auto-assign')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  autoAssignLead(@Request() req: any, @Param('leadId') leadId: string) {
    const clubId = req.clubId || req.user?.activeClubId;
    return this.kpiService.autoAssignLead(clubId, leadId);
  }

  @Post('leads/:leadId/score')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  scoreLead(@Param('leadId') leadId: string) {
    return this.kpiService.scoreLead(leadId);
  }
}
