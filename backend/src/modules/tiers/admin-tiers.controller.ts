import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TiersService } from './tiers.service';
import { CreateTierDto, UpdateTierDto } from './tiers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTiersController {
  constructor(private readonly tiersService: TiersService) {}

  @Post()
  create(@Body() dto: CreateTierDto) {
    return this.tiersService.create(dto);
  }

  @Post('defaults/:clubId')
  createDefaults(@Param('clubId') clubId: string) {
    return this.tiersService.createDefaultTiers(clubId);
  }

  @Get()
  findAll() {
    return this.tiersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tiersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTierDto) {
    return this.tiersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tiersService.remove(id);
  }
}
