import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Parent Marketplace endpoints
 * GET  /api/marketplace/groups — browse available groups
 * GET  /api/marketplace/groups/:id — group detail
 * POST /api/marketplace/assign — auto-assign or choose group
 */
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('groups')
  async getGroups(
    @Query('programType') programType?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.marketplaceService.getMarketplaceGroups({ programType, locationId });
  }

  @Get('groups/:id')
  async getGroupDetail(@Param('id') id: string) {
    return this.marketplaceService.getGroupDetail(id);
  }

  @Post('assign')
  async assignStudent(
    @Body() body: { childId: string; programType?: string; locationId?: string; groupId?: string },
  ) {
    return this.marketplaceService.assignStudent(body.childId, {
      programType: body.programType,
      locationId: body.locationId,
      groupId: body.groupId,
    });
  }

  @Post('update-scores')
  async updateScores() {
    return this.marketplaceService.updateGroupScores();
  }
}

/**
 * Admin marketplace controls
 * PATCH /api/admin/groups/:id/visibility
 * PATCH /api/admin/groups/:id/capacity
 * PATCH /api/admin/groups/:id/boost
 */
@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminMarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Patch('groups/:id/visibility')
  async updateVisibility(
    @Param('id') id: string,
    @Body() body: { isPublic: boolean },
  ) {
    return this.marketplaceService.updateVisibility(id, body.isPublic);
  }

  @Patch('groups/:id/capacity')
  async updateCapacity(
    @Param('id') id: string,
    @Body() body: { capacity: number },
  ) {
    return this.marketplaceService.updateCapacity(id, body.capacity);
  }

  @Patch('groups/:id/boost')
  async updateBoost(
    @Param('id') id: string,
    @Body() body: { priorityBoost: number },
  ) {
    return this.marketplaceService.updateBoost(id, body.priorityBoost);
  }
}
