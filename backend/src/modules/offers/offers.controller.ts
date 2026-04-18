import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Admin offers endpoints
 * GET  /api/admin/offers — list all offers
 * GET  /api/admin/offers/stats — offer statistics
 */
@Controller('admin/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async getAllOffers(@Query('includeExpired') includeExpired?: string) {
    return this.offersService.getAllOffers(includeExpired === 'true');
  }

  @Get('stats')
  async getOfferStats() {
    return this.offersService.getAdminOfferStats();
  }
}

/**
 * Parent offers endpoints
 * GET  /api/parent/offers — my offers
 * POST /api/parent/offers/:id/accept — accept an offer
 */
@Controller('parent/offers')
@UseGuards(JwtAuthGuard)
export class ParentOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async getMyOffers(@Request() req: any) {
    const parentId = req.user.sub;
    return this.offersService.getParentOffers(parentId);
  }

  @Post(':id/accept')
  async acceptOffer(@Param('id') offerId: string, @Request() req: any) {
    const parentId = req.user.sub;
    return this.offersService.acceptOffer(offerId, parentId);
  }
}

/**
 * System endpoints
 * POST /api/system/retention/run — trigger retention offer generation
 */
@Controller('system/retention')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemOffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post('run')
  async runRetention() {
    return this.offersService.runRetentionOffers();
  }
}
