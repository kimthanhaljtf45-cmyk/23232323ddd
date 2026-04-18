import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CompetitionsService } from './competitions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { UpdateParticipantStatusDto } from './dto/update-participant-status.dto';
import { CreateResultDto } from './dto/create-result.dto';

@Controller('admin/competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitionsService.create(dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.competitionsService.findAll(status);
  }

  @Get('stats')
  getStats() {
    return this.competitionsService.getStats();
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<any> {
    return this.competitionsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompetitionDto) {
    return this.competitionsService.update(id, dto);
  }

  @Post(':id/participant-status')
  updateParticipantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateParticipantStatusDto,
  ) {
    return this.competitionsService.updateParticipantStatus(id, dto);
  }

  @Post('participants/:participantId/mark-paid')
  markPaid(@Param('participantId') participantId: string) {
    return this.competitionsService.markPaid(participantId);
  }

  @Post(':id/result')
  addResult(@Param('id') id: string, @Body() dto: CreateResultDto) {
    return this.competitionsService.addResult(id, dto);
  }

  @Get(':id/stats')
  getCompetitionStats(@Param('id') id: string) {
    return this.competitionsService.getCompetitionDetailedStats(id);
  }
}
