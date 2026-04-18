import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../../schemas/user.schema';
import { Otp, OtpDocument } from '../../schemas/otp.schema';
import { SmsService } from '../sms/sms.service';
import { RequestOtpDto, VerifyOtpDto, MockAuthDto } from './dto';

// =====================
// CONSTANTS - FROZEN
// =====================
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_DELAY_SECONDS = 30;
const OTP_MAX_PER_HOUR = 5; // Rate limit

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
  ) {}

  // =====================
  // TOKEN GENERATION
  // =====================

  private generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret') || 'refresh-secret-key',
      expiresIn: this.config.get<string>('jwt.refreshExpires') || '7d',
    });

    return { accessToken, refreshToken };
  }

  private serializeUser(user: UserDocument) {
    const obj = user.toObject();
    return {
      id: obj._id.toString(),
      firstName: obj.firstName,
      lastName: obj.lastName,
      phone: obj.phone,
      role: obj.role,
      status: obj.status,
      programType: obj.programType,
      isOnboarded: obj.isOnboarded,
      avatarUrl: obj.avatarUrl || null,
    };
  }

  // =====================
  // PHONE NORMALIZATION & VALIDATION
  // =====================

  private normalizePhone(phone: string): string {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');
    
    // Handle different formats
    if (digits.startsWith('380')) {
      digits = digits; // Already correct
    } else if (digits.startsWith('80')) {
      digits = '3' + digits;
    } else if (digits.startsWith('0')) {
      digits = '38' + digits;
    } else if (digits.length === 9) {
      digits = '380' + digits;
    }

    return '+' + digits;
  }

  private validatePhone(phone: string): boolean {
    // Ukrainian phone number validation
    const normalized = this.normalizePhone(phone);
    // Valid format: +380XXXXXXXXX (12 digits total after +)
    const phoneRegex = /^\+380\d{9}$/;
    return phoneRegex.test(normalized);
  }

  // =====================
  // OTP FLOW - STEP 1: REQUEST
  // =====================

  async requestOtp(dto: RequestOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    this.logger.log(`📱 OTP request for: ${phone}`);

    // Validate phone number format
    if (!this.validatePhone(dto.phone)) {
      throw new BadRequestException('Невірний формат номера телефону. Використовуйте формат +380XXXXXXXXX');
    }

    // 1. Rate limit check - max 5 OTP per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.otpModel.countDocuments({
      phone,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentCount >= OTP_MAX_PER_HOUR) {
      this.logger.warn(`Rate limit exceeded for ${phone}`);
      throw new BadRequestException('Перевищено ліміт запитів. Спробуйте через годину.');
    }

    // 2. Resend delay check - 30 seconds between requests
    const recentOtp = await this.otpModel.findOne({
      phone,
      isUsed: false,
      createdAt: { $gte: new Date(Date.now() - OTP_RESEND_DELAY_SECONDS * 1000) },
    });

    if (recentOtp) {
      const waitTime = Math.ceil(
        (OTP_RESEND_DELAY_SECONDS * 1000 - (Date.now() - recentOtp.createdAt!.getTime())) / 1000
      );
      throw new BadRequestException(`Зачекайте ${waitTime} секунд перед повторним запитом`);
    }

    // 3. Invalidate previous unused OTPs for this phone
    await this.otpModel.updateMany(
      { phone, isUsed: false },
      { isUsed: true }
    );

    // 4. Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 5. Save to MongoDB
    await this.otpModel.create({
      phone,
      code,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });

    // 6. Send SMS (mock or real depending on env)
    const smsResult = await this.smsService.sendOtp(phone, code);
    
    if (!smsResult.success) {
      this.logger.error(`SMS sending failed: ${smsResult.error}`);
      // Don't block the flow in dev mode
    }

    return {
      success: true,
      message: 'Код відправлено на ваш номер',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      resendIn: OTP_RESEND_DELAY_SECONDS,
    };
  }

  // =====================
  // OTP FLOW - STEP 2: VERIFY
  // =====================

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    this.logger.log(`🔐 OTP verify for: ${phone}`);

    // DEV MODE BYPASS: Accept '0000' as universal code in non-production
    const isDev = (this.config.get<string>('NODE_ENV') || 'development') !== 'production';
    const isBypassCode = dto.code === '0000' || dto.code === '000000';

    if (isDev && isBypassCode) {
      this.logger.warn(`⚡ DEV BYPASS: Accepting code ${dto.code} for ${phone}`);
      // Mark any existing OTPs as used
      await this.otpModel.updateMany({ phone, isUsed: false }, { isUsed: true });
    } else {
      // 1. Find valid OTP
      const otp = await this.otpModel.findOne({
        phone,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otp) {
        throw new BadRequestException('Код не знайдено або прострочено. Запросіть новий.');
      }

      // 2. Check attempts (brute force protection)
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        await this.otpModel.updateOne({ _id: otp._id }, { isUsed: true });
        throw new BadRequestException('Вичерпано спроби. Запросіть новий код.');
      }

      // 3. Verify code
      if (otp.code !== dto.code) {
        await this.otpModel.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
        const remaining = OTP_MAX_ATTEMPTS - otp.attempts - 1;
        throw new BadRequestException(`Невірний код. Залишилось спроб: ${remaining}`);
      }

      // 4. Mark OTP as used
      await this.otpModel.updateOne(
        { _id: otp._id },
        { isUsed: true, usedAt: new Date() }
      );
    }

    // 5. Find or create user - CRITICAL: НЕ ДУБЛЮВАТИ!
    let user = await this.userModel.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      // Create new user with PENDING status
      user = await this.userModel.create({
        phone,
        role: 'PARENT', // Default, will be set during onboarding
        status: 'PENDING_ONBOARDING',
        isOnboarded: false,
      });
      isNewUser = true;
      this.logger.log(`🆕 New user created for ${phone}`);
    } else {
      this.logger.log(`✅ Existing user found for ${phone}, role: ${user.role}`);
    }

    // 6. Generate tokens
    const tokens = this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.serializeUser(user),
      isNewUser,
      needsOnboarding: !user.isOnboarded,
    };
  }

  // =====================
  // ROLE SELECTION (Onboarding)
  // =====================

  async selectRole(userId: string, role: 'PARENT' | 'STUDENT', programType?: string) {
    if (!['STUDENT', 'PARENT'].includes(role)) {
      throw new BadRequestException('Можна обрати лише роль Учень або Батьки.');
    }

    const updateData: any = {
      role,
      status: 'ACTIVE',
      isOnboarded: true,
    };

    if (programType) {
      updateData.programType = programType;
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true },
    );

    if (!user) {
      throw new BadRequestException('Користувача не знайдено');
    }

    const tokens = this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      user: this.serializeUser(user),
    };
  }

  // =====================
  // TOKEN REFRESH
  // =====================

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret') || 'refresh-secret-key',
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const tokens = this.generateTokens(user);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new BadRequestException('Invalid refresh token');
    }
  }

  // =====================
  // LOGOUT
  // =====================

  async logout() {
    return { message: 'Logged out successfully' };
  }

  // =====================
  // GET CURRENT USER
  // =====================

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return this.serializeUser(user);
  }

  // =====================
  // MOCK LOGIN (DEV ONLY)
  // =====================

  async mockLogin(dto: MockAuthDto) {
    this.logger.log(`🔧 Mock login for telegramId: ${dto.telegramId}`);
    
    // Find user by telegramId
    let user = await this.userModel.findOne({ telegramId: dto.telegramId });
    
    if (!user) {
      // Create if doesn't exist (for dev purposes)
      user = await this.userModel.create({
        telegramId: dto.telegramId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        role: 'PARENT',
        status: 'ACTIVE',
        isOnboarded: true,
      });
      this.logger.log(`🆕 Created mock user: ${dto.firstName}`);
    }

    const tokens = this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.serializeUser(user),
    };
  }

  // =====================
  // GOOGLE AUTH
  // =====================

  /**
   * Authenticate with Google ID token
   * This verifies the token and creates/finds user
   */
  async googleAuth(idToken: string, referralCode?: string) {
    this.logger.log('Processing Google authentication');

    // Decode and verify Google ID token
    // In production, use google-auth-library to verify
    // For now, we'll decode the JWT and trust it (in dev mode)
    let googleUserData: {
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      sub: string; // Google user ID
    };

    try {
      // In development, accept mock tokens
      if (idToken.startsWith('mock_')) {
        // Mock token format: mock_email@example.com
        const mockEmail = idToken.replace('mock_', '');
        googleUserData = {
          email: mockEmail,
          name: mockEmail.split('@')[0],
          given_name: mockEmail.split('@')[0],
          sub: `google_${Date.now()}`,
        };
      } else {
        // Decode JWT (in production, verify with Google's public keys)
        const decoded = this.decodeGoogleToken(idToken);
        googleUserData = decoded;
      }
    } catch (error) {
      this.logger.error('Failed to decode Google token', error);
      throw new BadRequestException('Invalid Google token');
    }

    if (!googleUserData.email) {
      throw new BadRequestException('Email not found in Google token');
    }

    // Find existing user by googleId or email
    let user = await this.userModel.findOne({
      $or: [
        { googleId: googleUserData.sub },
        { email: googleUserData.email },
      ],
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      user = await this.userModel.create({
        email: googleUserData.email,
        googleId: googleUserData.sub,
        firstName: googleUserData.given_name || googleUserData.name,
        lastName: googleUserData.family_name,
        avatarUrl: googleUserData.picture,
        role: 'PARENT', // Default role, can be changed in onboarding
        status: 'ACTIVE',
        isOnboarded: false,
      });

      // Apply referral code if provided
      if (referralCode) {
        await this.applyReferralCode(user._id.toString(), referralCode);
      }

      this.logger.log(`Created new user via Google: ${googleUserData.email}`);
    } else {
      // Update googleId if not set (user registered via phone first)
      if (!user.googleId) {
        user.googleId = googleUserData.sub;
        await user.save();
      }
      this.logger.log(`Existing user logged in via Google: ${googleUserData.email}`);
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.serializeUser(user),
      isNewUser,
      needsOnboarding: !user.isOnboarded,
    };
  }

  /**
   * Decode Google ID token (basic JWT decode)
   * In production, use google-auth-library for proper verification
   */
  private decodeGoogleToken(idToken: string): any {
    try {
      // JWT format: header.payload.signature
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode payload (base64url)
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new BadRequestException('Invalid Google token format');
    }
  }

  /**
   * Apply referral code for new user
   */
  private async applyReferralCode(userId: string, referralCode: string) {
    try {
      // Find inviter by referral code
      const inviter = await this.userModel.findOne({
        referralCode: referralCode.toUpperCase(),
      });

      if (inviter && inviter._id.toString() !== userId) {
        // Update the new user with referrer info
        await this.userModel.findByIdAndUpdate(userId, {
          referredBy: inviter._id.toString(),
        });
        this.logger.log(`Applied referral code ${referralCode} for user ${userId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to apply referral code: ${error.message}`);
      // Don't throw - referral failure shouldn't block registration
    }
  }
}
