import { Controller, Get, Post, Param, Body, UseGuards, Request, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TournamentsService } from './tournaments.service';
import { TournamentStatus } from '../../schemas/tournament.schema';

@Controller('admin/tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TournamentsAdminController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  async createTournament(@Request() req, @Body() body: any) {
    return this.tournamentsService.createTournament(body, req.user.sub);
  }

  @Get()
  async getAllTournaments() {
    return this.tournamentsService.getAllTournaments();
  }

  @Get(':id')
  async getTournamentById(@Param('id') id: string) {
    return this.tournamentsService.getTournamentById(id);
  }

  @Post(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: TournamentStatus }) {
    return this.tournamentsService.updateTournamentStatus(id, body.status);
  }

  @Get(':id/participants')
  async getParticipants(@Param('id') id: string) {
    return this.tournamentsService.getTournamentParticipants(id);
  }

  @Get(':id/results')
  async getResults(@Param('id') id: string) {
    return this.tournamentsService.getTournamentResults(id);
  }

  @Post(':id/results')
  async addResult(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.tournamentsService.addResult(id, body, req.user.sub);
  }
}
