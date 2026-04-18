import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MetaBrainService } from './meta-brain.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('meta')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetaBrainController {
  constructor(private readonly metaService: MetaBrainService) {}

  @Get('child/:id')
  @Roles('ADMIN', 'COACH', 'PARENT')
  async getChildAnalysis(@Param('id') childId: string) {
    return this.metaService.analyzeChild(childId);
  }

  @Get('coach')
  @Roles('COACH')
  async getCoachInsights(@CurrentUser() user: any) {
    return this.metaService.getCoachInsights(user.sub);
  }

  @Get('admin')
  @Roles('ADMIN')
  async getAdminInsights() {
    return this.metaService.getAdminInsights();
  }

  @Get('parent')
  @Roles('PARENT')
  async getParentInsights(@CurrentUser() user: any) {
    return this.metaService.getParentInsights(user.sub);
  }
}
