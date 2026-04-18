import { Body, Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /**
   * Register a device push token
   */
  @Post('register')
  async registerDevice(
    @Body() body: { token: string; platform: 'ios' | 'android' | 'web' },
    @CurrentUser() user: any,
  ) {
    return this.pushService.registerToken(user.id, body.token, body.platform);
  }

  /**
   * Unregister a device push token
   */
  @Post('unregister')
  async unregisterDevice(
    @Body() body: { token: string },
    @CurrentUser() user: any,
  ) {
    return this.pushService.unregisterToken(user.id, body.token);
  }

  /**
   * Get user's registered tokens
   */
  @Get('tokens')
  async getTokens(@CurrentUser() user: any) {
    const tokens = await this.pushService.getUserTokens(user.id);
    return { tokens, count: tokens.length };
  }

  /**
   * Test push notification (development only)
   */
  @Post('test-push')
  async testPush(@CurrentUser() user: any) {
    return this.pushService.sendToUser(
      user.id,
      '🧪 Тестове сповіщення',
      'Якщо ви бачите це повідомлення, push-сповіщення працюють!',
      { test: true },
    );
  }
}
