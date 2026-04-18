import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TournamentsService } from './tournaments.service';

@Controller('student/tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
export class TournamentsStudentController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get('my')
  async getMyTournaments(@Request() req) {
    // For student, the childId is the user's own ID or linked child
    // This depends on your data model
    return this.tournamentsService.getStudentTournaments(req.user.sub);
  }

  @Get('results')
  async getMyResults(@Request() req) {
    return this.tournamentsService.getStudentResults(req.user.sub);
  }
}
