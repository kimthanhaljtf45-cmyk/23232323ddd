import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RequestOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  MockAuthDto,
  GoogleAuthDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =====================
  // PUBLIC ENDPOINTS
  // =====================

  /**
   * Step 1: Request OTP code
   * POST /api/auth/request-otp
   * Body: { phone: "+380XXXXXXXXX" }
   */
  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  /**
   * Step 2: Verify OTP and login
   * POST /api/auth/verify-otp
   * Body: { phone: "+380XXXXXXXXX", code: "123456" }
   */
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * Body: { refreshToken: "..." }
   */
  @Post('refresh')
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * Logout
   * POST /api/auth/logout
   */
  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  // =====================
  // PROTECTED ENDPOINTS
  // =====================

  /**
   * Get current user
   * GET /api/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }

  /**
   * Select role during onboarding (PARENT or STUDENT only)
   * POST /api/auth/select-role
   * Body: { role: "PARENT" | "STUDENT", programType?: string }
   */
  @Post('select-role')
  @UseGuards(JwtAuthGuard)
  selectRole(
    @CurrentUser() user: any,
    @Body() body: { role: 'PARENT' | 'STUDENT'; programType?: string },
  ) {
    return this.authService.selectRole(user.id, body.role, body.programType);
  }

  /**
   * Mock login for development (by telegramId)
   * POST /api/auth/mock
   * Body: { telegramId: "100000004", firstName?: "Test" }
   */
  @Post('mock')
  mockLogin(@Body() dto: MockAuthDto) {
    return this.authService.mockLogin(dto);
  }

  /**
   * Google OAuth login
   * POST /api/auth/google
   * Body: { idToken: "...", referralCode?: "ATAKA123" }
   */
  @Post('google')
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto.idToken, dto.referralCode);
  }
}
