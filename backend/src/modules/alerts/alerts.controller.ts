import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsEngine } from './alerts.engine';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly alertsEngine: AlertsEngine,
  ) {}

  @Get()
  async getMyAlerts(
    @Request() req: any,
    @Query('includeResolved') includeResolved?: string,
  ) {
    const userId = req.user.sub;
    return this.alertsService.findByUser(userId, includeResolved === 'true');
  }

  @Get('summary')
  async getSummary(@Request() req: any) {
    const userId = req.user.sub;
    return this.alertsService.getSummary(userId);
  }

  @Get('critical')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  async getCriticalAlerts() {
    return this.alertsService.findCritical();
  }

  @Get('child/:childId')
  async getChildAlerts(
    @Param('childId') childId: string,
    @Query('includeResolved') includeResolved?: string,
  ) {
    return this.alertsService.findByChild(childId, includeResolved === 'true');
  }

  @Post(':id/resolve')
  async resolveAlert(
    @Param('id') alertId: string,
    @Request() req: any,
  ) {
    return this.alertsService.resolve(alertId, req.user.sub);
  }

  @Post('run')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async runEngine() {
    return this.alertsEngine.run();
  }
}
