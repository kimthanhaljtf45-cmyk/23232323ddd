import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DiscountsService, DiscountResult } from './discounts.service';
import { CreateDiscountRuleDto, UpdateDiscountRuleDto, ApplyPromoCodeDto, CalculateDiscountDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ==================== USER ENDPOINTS ====================

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyAppliedDiscounts(@Request() req: any) {
    return this.discountsService.getAppliedDiscounts(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  async calculateDiscounts(
    @Request() req: any,
    @Body() dto: CalculateDiscountDto,
  ): Promise<DiscountResult> {
    return this.discountsService.calculateDiscounts(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('validate-promo')
  async validatePromoCode(
    @Request() req: any,
    @Body() dto: ApplyPromoCodeDto,
  ) {
    return this.discountsService.validatePromoCode(dto.promoCode, req.user.id);
  }

  // ==================== PUBLIC ACTIVE RULES ====================

  @Get('available')
  async getAvailableDiscounts() {
    const rules = await this.discountsService.getAllRules(false);
    // Return only public-safe info
    return rules
      .filter(r => r.type !== 'MANUAL')
      .map(r => ({
        name: r.name,
        type: r.type,
        valueType: r.valueType,
        value: r.value,
        description: r.description,
      }));
  }
}

@Controller('admin/discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  async getAllRules(@Query('includeInactive') includeInactive?: string) {
    return this.discountsService.getAllRules(includeInactive === 'true');
  }

  @Get('stats')
  async getDiscountStats() {
    return this.discountsService.getDiscountStats();
  }

  @Get(':id')
  async getRuleById(@Param('id') id: string) {
    return this.discountsService.getRuleById(id);
  }

  @Post()
  async createRule(@Body() dto: CreateDiscountRuleDto) {
    return this.discountsService.createRule(dto);
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountRuleDto,
  ) {
    return this.discountsService.updateRule(id, dto);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string) {
    await this.discountsService.deleteRule(id);
    return { success: true };
  }

  @Patch(':id/toggle')
  async toggleRule(@Param('id') id: string) {
    return this.discountsService.toggleRule(id);
  }

  @Post('manual')
  async applyManualDiscount(@Body() dto: any) {
    return this.discountsService.applyManualDiscount(dto);
  }

  @Post('preview')
  async previewDiscount(@Body() dto: CalculateDiscountDto & { parentId?: string }) {
    const userId = dto.parentId || dto.childId;
    if (!userId) {
      return { baseAmount: dto.baseAmount, discountAmount: 0, finalAmount: dto.baseAmount, appliedRules: [] };
    }
    return this.discountsService.calculateDiscounts(userId, dto);
  }

  @Get('stats/detailed')
  async getDetailedStats() {
    return this.discountsService.getDetailedDiscountStats();
  }

  @Post('seed')
  async seedDefaultRules() {
    await this.discountsService.seedDefaultRules();
    return { success: true, message: 'Default discount rules seeded' };
  }
}
