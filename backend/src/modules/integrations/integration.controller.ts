import { Controller, Get, Post, Body } from '@nestjs/common';
import { IntegrationService } from './integration.service';

@Controller('admin/integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get('payment')
  async getPaymentConfig() {
    try {
      const config = await this.integrationService.getActivePaymentConfig('default');
      if (!config) {
        return {
          provider: 'WAYFORPAY',
          mode: 'TEST',
          merchantAccount: 'test_merch_n1',
          enabled: true,
          isTestMode: true,
        };
      }
      return {
        provider: config.provider,
        mode: config.mode,
        merchantAccount: config.credentials?.merchantAccount || 'test_merch_n1',
        enabled: true,
        isTestMode: config.mode === 'TEST',
        settings: config.settings,
      };
    } catch {
      return {
        provider: 'WAYFORPAY',
        mode: 'TEST',
        merchantAccount: 'test_merch_n1',
        enabled: true,
        isTestMode: true,
      };
    }
  }

  @Post('payment')
  async savePaymentConfig(
    @Body() body: { merchantAccount: string; secretKey: string; mode: string },
  ) {
    const credentials = {
      merchantAccount: body.merchantAccount,
      merchantSecretKey: body.secretKey,
    };
    const settings = {
      merchantDomainName: 'ataka.com.ua',
    };
    const result = await this.integrationService.savePaymentConfig(
      'default',
      'WAYFORPAY',
      credentials,
      settings,
      body.mode as 'TEST' | 'LIVE',
    );
    return { success: true, mode: body.mode };
  }

  @Get()
  async listIntegrations() {
    return this.integrationService.listIntegrations('default');
  }
}
