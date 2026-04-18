import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('select-program')
  selectProgram(
    @CurrentUser() user: any,
    @Body() body: { programType: string }
  ) {
    return this.onboardingService.selectProgram(user.id, body.programType);
  }

  @Post('submit')
  submitOnboarding(
    @CurrentUser() user: any,
    @Body() body: {
      childName?: string;
      age?: number;
      goal?: string;
      district?: string;
      preferredSchedule?: string[];
      specialNotes?: string;
    }
  ) {
    return this.onboardingService.submitOnboarding(user.id, body);
  }

  @Get('recommendation')
  getRecommendation(@CurrentUser() user: any) {
    return this.onboardingService.getRecommendation(user.id);
  }
}
