import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CompetitionsService } from './competitions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JoinCompetitionDto } from './dto/join-competition.dto';

@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('programType') programType?: string,
  ) {
    return this.competitionsService.findAll(status, programType);
  }

  @Get('champions')
  getChampions(@Query('limit') limit?: string) {
    return this.competitionsService.getChampions(limit ? parseInt(limit) : 20);
  }

  @Get('upcoming')
  getUpcoming(@Query('limit') limit?: string) {
    return this.competitionsService.getUpcoming(limit ? parseInt(limit) : 5);
  }

  @Get('stats')
  getStats() {
    return this.competitionsService.getStats();
  }

  @Get('my/list')
  @UseGuards(JwtAuthGuard)
  getMyCompetitions(@CurrentUser() user: any) {
    return this.competitionsService.getMyCompetitions(user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<any> {
    return this.competitionsService.findById(id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(
    @Param('id') id: string,
    @Body() dto: JoinCompetitionDto,
    @CurrentUser() user: any,
  ) {
    return this.competitionsService.joinCompetition(id, dto, user.id);
  }
}
