import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

@Controller('catalog')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // Get all locations (public)
  @Get('locations')
  getLocations(@Query('district') district?: string) {
    return this.marketplaceService.getLocations(district);
  }

  // Get location by ID (public)
  @Get('locations/:id')
  getLocation(@Param('id') id: string) {
    return this.marketplaceService.getLocationById(id);
  }

  // Get all programs (public)
  @Get('programs')
  getPrograms(@Query('type') type?: string) {
    return this.marketplaceService.getPrograms(type);
  }

  // Get program by ID (public)
  @Get('programs/:id')
  getProgram(@Param('id') id: string) {
    return this.marketplaceService.getProgramById(id);
  }

  // Get all coaches (public)
  @Get('coaches')
  getCoaches(@Query('locationId') locationId?: string) {
    return this.marketplaceService.getCoaches(locationId);
  }

  // Get coach by ID (public)
  @Get('coaches/:id')
  getCoach(@Param('id') id: string) {
    return this.marketplaceService.getCoachById(id);
  }

  // Get groups by location or program (public)
  @Get('groups')
  getGroups(
    @Query('locationId') locationId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.marketplaceService.getGroups(locationId, programId);
  }

  // Search across locations, programs, coaches (public)
  @Get('search')
  search(@Query('q') query: string) {
    return this.marketplaceService.search(query);
  }
}
