import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.interface';

/**
 * Mock SMS Service - для dev/staging
 * Логує SMS в консоль замість реальної відправки
 */
@Injectable()
export class SmsMockService implements SmsProvider {
  private readonly logger = new Logger('SmsMockService');

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const messageId = `mock-${Date.now()}`;
    
    this.logger.log('═══════════════════════════════════════');
    this.logger.log(`📲 MOCK SMS → ${phone}`);
    this.logger.log(`📝 Message: ${message}`);
    this.logger.log(`🆔 MessageId: ${messageId}`);
    this.logger.log('═══════════════════════════════════════');
    
    return { success: true, messageId };
  }
}
