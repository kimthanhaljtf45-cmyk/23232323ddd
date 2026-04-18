import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SmsProvider } from './sms.interface';

/**
 * TurboSMS Service - для production
 * HTTP API: https://turbosms.ua/api.html
 */
@Injectable()
export class SmsTurboSmsService implements SmsProvider {
  private readonly logger = new Logger('SmsTurboSmsService');
  private readonly apiUrl = 'https://api.turbosms.ua/message/send.json';
  private readonly apiKey: string;
  private readonly senderName: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('TURBOSMS_API_KEY') || '';
    this.senderName = this.config.get<string>('TURBOSMS_SENDER') || 'ATAKA';
  }

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) {
      this.logger.error('TurboSMS API key not configured!');
      return { success: false, error: 'SMS provider not configured' };
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          recipients: [phone],
          sms: {
            sender: this.senderName,
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data?.response_code === 0) {
        const messageId = response.data?.response_result?.[0]?.message_id;
        this.logger.log(`✅ SMS sent to ${phone}, messageId: ${messageId}`);
        return { success: true, messageId };
      } else {
        this.logger.error(`TurboSMS error: ${JSON.stringify(response.data)}`);
        return { success: false, error: response.data?.response_status || 'Unknown error' };
      }
    } catch (error: any) {
      this.logger.error(`TurboSMS request failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
