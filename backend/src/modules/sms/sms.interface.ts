/**
 * SMS Provider Interface
 * Абстракція для легкої заміни SMS провайдера
 */
export interface SmsProvider {
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface SmsConfig {
  provider: 'mock' | 'turbosms';
  senderName: string;
  apiKey?: string;
}
