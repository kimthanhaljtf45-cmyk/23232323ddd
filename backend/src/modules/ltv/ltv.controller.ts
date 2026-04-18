import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { LtvEngineService } from './ltv-engine.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('ltv')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH', 'ADMIN')
export class LtvController {
  constructor(private readonly ltvEngine: LtvEngineService) {}

  /**
   * GET /api/ltv/student/:studentId - Get student LTV data
   */
  @Get('student/:studentId')
  async getStudentLtv(@Param('studentId') studentId: string) {
    return this.ltvEngine.getStudentLtv(studentId);
  }

  /**
   * POST /api/ltv/student/:studentId/recalculate - Force recalculate LTV
   */
  @Post('student/:studentId/recalculate')
  async recalculateStudentLtv(@Param('studentId') studentId: string) {
    return this.ltvEngine.calculateStudentLtv(studentId);
  }

  /**
   * GET /api/ltv/group/:groupId - Get group revenue analytics
   */
  @Get('group/:groupId')
  async getGroupRevenue(@Param('groupId') groupId: string) {
    return this.ltvEngine.getGroupRevenue(groupId);
  }

  /**
   * GET /api/ltv/coach - Get coach revenue analytics
   */
  @Get('coach')
  async getCoachRevenue(@CurrentUser() user: any) {
    return this.ltvEngine.getCoachRevenue(user.id);
  }

  /**
   * GET /api/ltv/student/:studentId/discount - Get discount recommendation
   */
  @Get('student/:studentId/discount')
  async getDiscountRecommendation(@Param('studentId') studentId: string) {
    return this.ltvEngine.getDiscountRecommendation(studentId);
  }

  /**
   * POST /api/ltv/check-discount - Check if discount is viable
   */
  @Post('check-discount')
  async checkDiscount(@Body() body: { ltvPredicted: number; discountAmount: number }) {
    return this.ltvEngine.shouldGiveDiscount(body.ltvPredicted, body.discountAmount);
  }
}
