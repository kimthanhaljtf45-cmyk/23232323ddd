import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  findAll(@Query('clubId') clubId?: string) {
    return this.programsService.findAll(clubId);
  }

  @Get('type/:type')
  findByType(@Param('type') type: string, @Query('clubId') clubId?: string) {
    return this.programsService.findByType(type, clubId);
  }

  @Get('onboarding')
  getForOnboarding(
    @Query('forChild') forChild: string,
    @Query('clubId') clubId?: string,
  ) {
    return this.programsService.getProgramsForOnboarding(forChild === 'true', clubId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.programsService.findOneWithCoaches(id);
  }
}
