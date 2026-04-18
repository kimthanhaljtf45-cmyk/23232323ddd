import { Controller, Get, Post, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  /**
   * Get 2FA status
   */
  @Get('2fa/status')
  async getStatus(@Req() req: any) {
    return this.securityService.getStatus(req.user.id);
  }

  /**
   * Check if 2FA is required for current user
   */
  @Get('2fa/required')
  async checkRequired(@Req() req: any) {
    return this.securityService.requires2FA(req.user.id);
  }

  /**
   * Generate TOTP secret (step 1)
   */
  @Post('2fa/totp/setup')
  async setupTotp(@Req() req: any) {
    return this.securityService.generateTotpSecret(req.user.id);
  }

  /**
   * Verify and enable TOTP (step 2)
   */
  @Post('2fa/totp/verify')
  async verifyTotp(@Req() req: any, @Body() body: { token: string }) {
    return this.securityService.verifyAndEnableTotp(req.user.id, body.token);
  }

  /**
   * Verify TOTP token (for login/actions)
   */
  @Post('2fa/totp/validate')
  async validateTotp(@Req() req: any, @Body() body: { token: string }) {
    const valid = await this.securityService.verifyTotp(req.user.id, body.token);
    return { valid };
  }

  /**
   * Disable TOTP
   */
  @Delete('2fa/totp')
  async disableTotp(@Req() req: any, @Body() body: { token: string }) {
    await this.securityService.disableTotp(req.user.id, body.token);
    return { success: true };
  }

  /**
   * Enable biometric
   */
  @Post('2fa/biometric/enable')
  async enableBiometric(@Req() req: any) {
    await this.securityService.enableBiometric(req.user.id);
    return { success: true };
  }

  /**
   * Disable biometric
   */
  @Delete('2fa/biometric')
  async disableBiometric(@Req() req: any) {
    await this.securityService.disableBiometric(req.user.id);
    return { success: true };
  }
}
