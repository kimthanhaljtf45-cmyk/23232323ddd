import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TournamentsService } from './tournaments.service';

@Controller('coach/tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH')
export class TournamentsCoachController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  async getTournaments(@Request() req) {
    return this.tournamentsService.getCoachTournaments(req.user.sub);
  }

  @Get(':id')
  async getTournamentById(@Param('id') id: string) {
    return this.tournamentsService.getTournamentById(id);
  }

  @Post(':id/register')
  async registerStudent(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { childId: string; note?: string },
  ) {
    return this.tournamentsService.registerByCoach(
      id,
      body.childId,
      req.user.sub,
      body.note,
    );
  }

  @Get(':id/participants')
  async getParticipants(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getCoachParticipants(id, req.user.sub);
  }

  @Post(':id/results')
  async addResult(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.tournamentsService.addResult(id, body, req.user.sub);
  }
}
