import { Controller, Get, Param, Query } from '@nestjs/common';
import { TiersService } from './tiers.service';

@Controller('tiers')
export class TiersController {
  constructor(private readonly tiersService: TiersService) {}

  @Get()
  findAll(@Query('clubId') clubId?: string) {
    return this.tiersService.findAll(clubId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tiersService.findOne(id);
  }
}
