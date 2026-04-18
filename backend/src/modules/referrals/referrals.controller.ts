import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ApplyReferralCodeDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // Get user's referral code
  @UseGuards(JwtAuthGuard)
  @Get('my-code')
  async getMyReferralCode(@Request() req: any) {
    const code = await this.referralsService.getUserReferralCode(req.user.id);
    return { referralCode: code };
  }

  // Get user's referral stats
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyReferrals(@Request() req: any) {
    return this.referralsService.getUserReferrals(req.user.id);
  }

  // Apply referral code during registration/onboarding
  @UseGuards(JwtAuthGuard)
  @Post('apply')
  async applyReferralCode(
    @Request() req: any,
    @Body() dto: ApplyReferralCodeDto,
  ) {
    return this.referralsService.applyReferralCode(req.user.id, dto);
  }

  // Check if user has referral discount available
  @UseGuards(JwtAuthGuard)
  @Get('discount')
  async checkReferralDiscount(@Request() req: any) {
    return this.referralsService.hasReferralDiscount(req.user.id);
  }
}

@Controller('admin/referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  async getAllReferrals(@Query('status') status?: string) {
    return this.referralsService.getAllReferrals(status);
  }

  @Get('stats')
  async getReferralStats() {
    return this.referralsService.getReferralStats();
  }
}
