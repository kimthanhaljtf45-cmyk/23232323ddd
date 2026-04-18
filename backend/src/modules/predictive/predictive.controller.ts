import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { PredictiveService } from './predictive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('predictive')
@UseGuards(JwtAuthGuard)
export class PredictiveController {
  constructor(private readonly predictiveService: PredictiveService) {}

  /**
   * Get admin-level predictions overview
   */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getAdminPredictions(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.predictiveService.getAdminPredictions(tenantId);
  }

  /**
   * Get prediction for specific user
   */
  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER', 'COACH')
  async getUserPrediction(@Param('userId') userId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.predictiveService.predict(userId, tenantId);
  }
}
