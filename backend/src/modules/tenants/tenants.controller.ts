import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { TenantsService, CreateTenantDto, UpdateTenantDto } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantPlan } from '../../schemas/tenant.schema';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Create new tenant (Super Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  /**
   * Get all tenants (Super Admin only)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('plan') plan?: TenantPlan,
  ) {
    const options: any = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (plan) options.plan = plan;
    return this.tenantsService.findAll(options);
  }

  /**
   * Get SaaS overview (Super Admin only)
   */
  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async getSaasOverview() {
    return this.tenantsService.getSaasOverview();
  }

  /**
   * Get tenant by ID
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  async getById(@Param('id') id: string) {
    return this.tenantsService.getById(id);
  }

  /**
   * Get tenant by slug
   */
  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.tenantsService.getBySlug(slug);
  }

  /**
   * Update tenant
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'OWNER')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  /**
   * Upgrade tenant plan
   */
  @Post(':id/upgrade')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async upgradePlan(@Param('id') id: string, @Body('plan') plan: TenantPlan) {
    return this.tenantsService.upgradePlan(id, plan);
  }

  /**
   * Deactivate tenant
   */
  @Post(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async deactivate(@Param('id') id: string) {
    return this.tenantsService.deactivate(id);
  }

  /**
   * Activate tenant
   */
  @Post(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async activate(@Param('id') id: string) {
    return this.tenantsService.activate(id);
  }

  /**
   * Seed default tenant (development only)
   */
  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async seedDefault() {
    return this.tenantsService.seedDefault();
  }
}
