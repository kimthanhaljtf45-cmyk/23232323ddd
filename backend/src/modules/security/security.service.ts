import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { TwoFactor, TwoFactorDocument } from '../../schemas/two-factor.schema';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class SecurityService {
  constructor(
    @InjectModel(TwoFactor.name) private twoFactorModel: Model<TwoFactorDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Get 2FA status for user
   */
  async getStatus(userId: string) {
    const twoFactor = await this.twoFactorModel.findOne({ userId: new Types.ObjectId(userId) });
    
    if (!twoFactor) {
      return {
        totpEnabled: false,
        biometricEnabled: false,
        requireOnLogin: false,
        requireOnSensitiveActions: false,
      };
    }

    return {
      totpEnabled: twoFactor.totpEnabled,
      totpEnabledAt: twoFactor.totpEnabledAt,
      biometricEnabled: twoFactor.biometricEnabled,
      biometricEnabledAt: twoFactor.biometricEnabledAt,
      requireOnLogin: twoFactor.requireOnLogin,
      requireOnSensitiveActions: twoFactor.requireOnSensitiveActions,
    };
  }

  /**
   * Generate TOTP secret and QR code
   */
  async generateTotpSecret(userId: string): Promise<{ secret: string; qrCode: string; manualEntry: string }> {
    // Find user - userId is already the ObjectId string from JWT
    const user = await this.userModel.findById(userId).exec();
    
    if (!user) {
      throw new NotFoundException(`User not found for ID: ${userId}`);
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `ATAKA:${user.phone || user.firstName}`,
      issuer: 'ATAKA',
      length: 20,
    });

    // Generate QR code as base64
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    // Save secret (not enabled yet until verified)
    await this.twoFactorModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { 
        userId: new Types.ObjectId(userId),
        totpSecret: secret.base32,
      },
      { upsert: true }
    );

    return {
      secret: secret.base32,
      qrCode,
      manualEntry: secret.base32,
    };
  }

  /**
   * Verify TOTP token and enable 2FA
   */
  async verifyAndEnableTotp(userId: string, token: string): Promise<{ success: boolean; backupCodes?: string[] }> {
    const twoFactor = await this.twoFactorModel.findOne({ userId: new Types.ObjectId(userId) });
    
    if (!twoFactor?.totpSecret) {
      throw new BadRequestException('TOTP not set up. Please generate secret first.');
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: twoFactor.totpSecret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step tolerance
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedCodes = backupCodes.map(code => this.hashCode(code));

    // Enable TOTP
    await this.twoFactorModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        totpEnabled: true,
        totpEnabledAt: new Date(),
        totpBackupCodes: JSON.stringify(hashedCodes),
        requireOnLogin: true,
      }
    );

    return { success: true, backupCodes };
  }

  /**
   * Verify TOTP token (for login)
   */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const twoFactor = await this.twoFactorModel.findOne({ userId: new Types.ObjectId(userId) });
    
    if (!twoFactor?.totpEnabled || !twoFactor.totpSecret) {
      return true; // 2FA not enabled, allow
    }

    // Check if it's a backup code
    if (token.length === 8) {
      return this.verifyBackupCode(userId, token);
    }

    // Verify TOTP token
    return speakeasy.totp.verify({
      secret: twoFactor.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  /**
   * Disable TOTP
   */
  async disableTotp(userId: string, token: string): Promise<boolean> {
    // Verify token first
    const verified = await this.verifyTotp(userId, token);
    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.twoFactorModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: null,
        totpEnabledAt: null,
      }
    );

    return true;
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric(userId: string): Promise<boolean> {
    await this.twoFactorModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        biometricEnabled: true,
        biometricEnabledAt: new Date(),
      },
      { upsert: true }
    );
    return true;
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(userId: string): Promise<boolean> {
    await this.twoFactorModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        biometricEnabled: false,
        biometricEnabledAt: null,
      }
    );
    return true;
  }

  /**
   * Check if 2FA is required for user
   */
  async requires2FA(userId: string): Promise<{ required: boolean; methods: string[] }> {
    const twoFactor = await this.twoFactorModel.findOne({ userId: new Types.ObjectId(userId) });
    
    if (!twoFactor) {
      return { required: false, methods: [] };
    }

    const methods: string[] = [];
    if (twoFactor.totpEnabled) methods.push('totp');
    if (twoFactor.biometricEnabled) methods.push('biometric');

    return {
      required: twoFactor.requireOnLogin && methods.length > 0,
      methods,
    };
  }

  // ============ Private methods ============

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const twoFactor = await this.twoFactorModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!twoFactor?.totpBackupCodes) return false;

    const hashedCodes: string[] = JSON.parse(twoFactor.totpBackupCodes);
    const hashedInput = this.hashCode(code.toUpperCase());
    const index = hashedCodes.indexOf(hashedInput);

    if (index === -1) return false;

    // Remove used backup code
    hashedCodes.splice(index, 1);
    await this.twoFactorModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { totpBackupCodes: JSON.stringify(hashedCodes) }
    );

    return true;
  }
}
