import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('children')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get(':id/progress')
  getChildProgress(@Param('id') id: string) {
    return this.progressService.getChildProgress(id);
  }
}
