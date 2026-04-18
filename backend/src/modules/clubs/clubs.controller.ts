import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ClubsService } from './clubs.service';

@Controller('admin/clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  async create(@Body() body: { name: string; ownerUserId?: string; plan?: any; city?: string; address?: string; phone?: string; email?: string }) {
    return this.clubsService.create(body);
  }

  @Get()
  async findAll(@Query('status') status?: string, @Query('plan') plan?: string) {
    return this.clubsService.findAll({ status, plan });
  }

  @Get('overview')
  async getPlatformOverview() {
    return this.clubsService.getPlatformOverview();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.clubsService.getById(id);
  }

  @Get(':id/dashboard')
  async getDashboard(@Param('id') id: string) {
    return this.clubsService.getDashboard(id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.clubsService.getMemberships(id);
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() body: { userId: string; role: string }) {
    return this.clubsService.addMembership(id, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.clubsService.removeMembership(id, userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.clubsService.update(id, body);
  }

  @Patch(':id/plan')
  async changePlan(@Param('id') id: string, @Body() body: { plan: any }) {
    return this.clubsService.changePlan(id, body.plan);
  }

  @Get(':id/limits/:resource')
  async checkLimit(@Param('id') id: string, @Param('resource') resource: string) {
    return this.clubsService.checkLimit(id, resource as any);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.clubsService.delete(id);
  }

  @Post('seed')
  async seed(@Body() body: { adminUserId: string }) {
    return this.clubsService.seedDefaultClub(body.adminUserId);
  }
}
