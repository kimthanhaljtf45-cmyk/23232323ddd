import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IntegrationConfig,
  IntegrationConfigDocument,
} from '../../schemas/integration-config.schema';
import { IntegrationCryptoService } from './integration-crypto.service';

/**
 * INTEGRATION SERVICE
 * 
 * Manages external service integrations:
 * - Payment providers
 * - SMS providers
 * - Email providers
 * 
 * All credentials are encrypted at rest.
 */

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(IntegrationConfig.name)
    private readonly integrationModel: Model<IntegrationConfigDocument>,
    private readonly cryptoService: IntegrationCryptoService,
  ) {}

  /**
   * Get active payment configuration for tenant
   */
  async getActivePaymentConfig(tenantId: string = 'default') {
    const config = await this.integrationModel.findOne({
      tenantId,
      type: 'PAYMENT',
      enabled: true,
    });

    if (!config) {
      // Return default test config if none configured
      return {
        provider: 'WAYFORPAY',
        mode: 'TEST',
        credentials: {
          merchantAccount: 'test_merchant',
          merchantSecretKey: 'test_secret_key',
        },
        settings: {
          merchantDomainName: 'ataka.app',
          returnUrl: process.env.APP_URL || 'https://ataka.app/payment/success',
          serviceUrl: process.env.BACKEND_URL || 'https://ataka.app/api/payments/wayforpay/callback',
        },
      };
    }

    const decrypted = this.cryptoService.decrypt(config.credentialsEncrypted);

    return {
      provider: config.provider,
      mode: config.mode,
      credentials: decrypted,
      settings: config.settings ?? {},
    };
  }

  /**
   * Save payment configuration
   */
  async savePaymentConfig(
    tenantId: string,
    provider: string,
    credentials: Record<string, any>,
    settings: Record<string, any>,
    mode: 'TEST' | 'LIVE' = 'TEST',
  ) {
    const encrypted = this.cryptoService.encrypt(credentials);

    const existing = await this.integrationModel.findOne({
      tenantId,
      type: 'PAYMENT',
      provider,
    });

    if (existing) {
      existing.credentialsEncrypted = encrypted;
      existing.settings = settings;
      existing.mode = mode;
      existing.enabled = true;
      await existing.save();
      return existing;
    }

    return this.integrationModel.create({
      tenantId,
      type: 'PAYMENT',
      provider,
      credentialsEncrypted: encrypted,
      settings,
      mode,
      enabled: true,
    });
  }

  /**
   * Disable all payment configs except specified
   */
  async setActivePaymentProvider(tenantId: string, provider: string) {
    await this.integrationModel.updateMany(
      { tenantId, type: 'PAYMENT' },
      { $set: { enabled: false } },
    );

    await this.integrationModel.updateOne(
      { tenantId, type: 'PAYMENT', provider },
      { $set: { enabled: true } },
    );
  }

  /**
   * List all integrations for tenant
   */
  async listIntegrations(tenantId: string = 'default') {
    const configs = await this.integrationModel.find({ tenantId });
    
    return configs.map(c => ({
      id: c._id.toString(),
      type: c.type,
      provider: c.provider,
      mode: c.mode,
      enabled: c.enabled,
      settings: c.settings,
      lastTestedAt: c.lastTestedAt,
      lastTestResult: c.lastTestResult,
    }));
  }
}
