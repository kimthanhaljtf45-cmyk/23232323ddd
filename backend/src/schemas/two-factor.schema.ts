import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TwoFactorDocument = TwoFactor & Document;

/**
 * Two-Factor Authentication Schema
 * 
 * Supports:
 * - TOTP (Google Authenticator)
 * - Biometric flag
 * - Recovery codes
 */
@Schema({ timestamps: true, collection: 'twofactors' })
export class TwoFactor {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // TOTP (Google Authenticator)
  @Prop({ type: Boolean, default: false })
  totpEnabled: boolean;

  @Prop({ type: String })
  totpSecret?: string;

  @Prop({ type: String })
  totpBackupCodes?: string; // JSON array of hashed codes

  @Prop({ type: Date })
  totpEnabledAt?: Date;

  // Biometric
  @Prop({ type: Boolean, default: false })
  biometricEnabled: boolean;

  @Prop({ type: Date })
  biometricEnabledAt?: Date;

  // Security settings
  @Prop({ type: Boolean, default: true })
  requireOnLogin: boolean;

  @Prop({ type: Boolean, default: false })
  requireOnSensitiveActions: boolean;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const TwoFactorSchema = SchemaFactory.createForClass(TwoFactor);
// userId index already created by unique: true on @Prop
