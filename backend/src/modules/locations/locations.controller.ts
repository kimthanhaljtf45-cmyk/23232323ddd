import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // Public endpoint for marketplace
  @Get()
  @Public()
  findAll(@Query('district') district?: string) {
    return this.locationsService.findAll(district);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.locationsService.findById(id);
  }
}
