import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { GrowthEngineService } from './growth-engine.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OfferSegment } from '../../schemas/offer-variant.schema';

@Controller('growth')
@UseGuards(JwtAuthGuard)
export class GrowthEngineController {
  constructor(private readonly growthService: GrowthEngineService) {}

  /**
   * Get all offers with stats (admin)
   */
  @Get('offers')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getOffers(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getOffersStats(tenantId);
  }

  /**
   * Get retention funnel analytics
   */
  @Get('retention-funnel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getRetentionFunnel(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getRetentionFunnel(tenantId);
  }

  /**
   * Get discount efficiency analytics
   */
  @Get('discount-efficiency')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getDiscountEfficiency(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getDiscountEfficiency(tenantId);
  }

  /**
   * Get referral analytics
   */
  @Get('referrals')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getReferralAnalytics(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getReferralAnalytics(tenantId);
  }

  /**
   * Get program analytics
   */
  @Get('programs')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getProgramAnalytics(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getProgramAnalytics(tenantId);
  }

  /**
   * Get coach performance analytics
   */
  @Get('coaches')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getCoachPerformance(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getCoachPerformance(tenantId);
  }

  /**
   * Get competition analytics
   */
  @Get('competitions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getCompetitionAnalytics(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getCompetitionAnalytics(tenantId);
  }

  /**
   * Get growth overview (aggregated)
   */
  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async getGrowthOverview(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.getGrowthOverview(tenantId);
  }

  /**
   * Create new offer variant (admin)
   */
  @Post('offers')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async createOffer(@Req() req: any, @Body() body: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.growthService.createOffer({
      ...body,
      tenantId,
    });
  }

  /**
   * Update offer (admin)
   */
  @Put('offers/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async updateOffer(@Param('id') id: string, @Body() body: any) {
    return this.growthService.updateOffer(id, body);
  }

  /**
   * Track conversion (called after payment)
   */
  @Post('offers/:id/conversion')
  async trackConversion(@Param('id') id: string) {
    await this.growthService.trackConversion(id);
    return { success: true };
  }

  /**
   * Run auto-optimization (admin)
   */
  @Post('optimize')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async runOptimize(
    @Req() req: any,
    @Query('minViews') minViews?: number,
    @Query('minCR') minCR?: number,
  ) {
    const tenantId = req.user?.tenantId || 'default';
    const disabled = await this.growthService.autoOptimize(
      tenantId,
      minViews || 50,
      minCR || 0.05,
    );
    return { disabledCount: disabled };
  }

  /**
   * Seed default offers (admin)
   */
  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OWNER')
  async seedOffers(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    await this.growthService.seedDefaultOffers(tenantId);
    return { success: true };
  }
}
