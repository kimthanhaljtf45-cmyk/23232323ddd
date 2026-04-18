import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms.interface';
import { SmsMockService } from './sms-mock.service';
import { SmsTurboSmsService } from './sms-turbosms.service';

/**
 * SMS Service Facade
 * Автоматично вибирає провайдера залежно від середовища
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');
  private provider: SmsProvider;

  constructor(
    private config: ConfigService,
    private mockService: SmsMockService,
    private turboService: SmsTurboSmsService,
  ) {
    const env = this.config.get<string>('NODE_ENV') || 'development';
    const forceMock = this.config.get<string>('SMS_MOCK') === 'true';
    const hasTurboKey = !!this.config.get<string>('TURBOSMS_API_KEY');

    // Production з ключем → TurboSMS, інакше → Mock
    if (env === 'production' && hasTurboKey && !forceMock) {
      this.provider = this.turboService;
      this.logger.log('📱 SMS Provider: TurboSMS (production)');
    } else {
      this.provider = this.mockService;
      this.logger.log('📱 SMS Provider: Mock (development)');
    }
  }

  /**
   * Відправити OTP код
   */
  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    const message = `АТАКА: Ваш код підтвердження: ${code}. Дійсний 5 хвилин.`;
    return this.provider.send(phone, message);
  }

  /**
   * Відправити довільне повідомлення
   */
  async send(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    return this.provider.send(phone, message);
  }
}
