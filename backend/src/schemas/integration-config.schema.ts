import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationConfigDocument = IntegrationConfig & Document;

/**
 * INTEGRATION CONFIG SCHEMA
 * 
 * Stores encrypted credentials for external services:
 * - Payment providers (WayForPay, LiqPay, Stripe)
 * - SMS providers (Twilio, MessageBird)
 * - Email providers (SendGrid)
 * 
 * Multi-tenant ready: each tenant can have own configs
 */

@Schema({ timestamps: true })
export class IntegrationConfig {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true, enum: ['PAYMENT', 'SMS', 'EMAIL', 'PUSH'] })
  type: string;

  @Prop({ required: true })
  provider: string; // 'WAYFORPAY', 'LIQPAY', 'TWILIO', etc.

  @Prop({ default: 'TEST', enum: ['TEST', 'LIVE'] })
  mode: string;

  @Prop({ required: true })
  credentialsEncrypted: string; // AES-256 encrypted JSON

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>; // Non-sensitive settings

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Date })
  lastTestedAt: Date;

  @Prop()
  lastTestResult: string;
}

export const IntegrationConfigSchema = SchemaFactory.createForClass(IntegrationConfig);

// Indexes
IntegrationConfigSchema.index({ tenantId: 1, type: 1, enabled: 1 });
IntegrationConfigSchema.index({ tenantId: 1, provider: 1 });
