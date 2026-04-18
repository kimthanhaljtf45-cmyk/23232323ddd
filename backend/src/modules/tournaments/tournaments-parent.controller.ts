import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TournamentsService } from './tournaments.service';

@Controller('parent/tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PARENT')
export class TournamentsParentController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  async getTournaments(@Request() req) {
    return this.tournamentsService.getParentTournaments(req.user.sub);
  }

  @Get('my')
  async getMyChildrenTournaments(@Request() req) {
    return this.tournamentsService.getMyChildrenTournaments(req.user.sub);
  }

  @Get(':id')
  async getTournamentDetails(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getParentTournamentDetails(id, req.user.sub);
  }

  @Post(':id/register')
  async registerChild(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { childId: string },
  ) {
    return this.tournamentsService.registerByParent(id, body.childId, req.user.sub);
  }
}
