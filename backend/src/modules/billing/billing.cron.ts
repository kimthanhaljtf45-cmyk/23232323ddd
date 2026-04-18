import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCron {
  private readonly logger = new Logger(BillingCron.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Генерація інвойсів - щодня о 3:00 ночі
   * Перевіряє активні підписки і створює рахунки
   */
  @Cron('0 3 * * *', {
    name: 'generateInvoices',
    timeZone: 'Europe/Kiev',
  })
  async handleInvoiceGeneration() {
    this.logger.log('🔄 Starting daily invoice generation...');
    
    try {
      const generated = await this.billingService.checkAndGenerateInvoices();
      this.logger.log(`✅ Invoice generation complete. Generated: ${generated}`);
    } catch (error) {
      this.logger.error('❌ Invoice generation failed:', error);
    }
  }

  /**
   * Перевірка прострочених платежів - щодня о 4:00 ночі
   * +3 дні = нагадування
   * +7 днів = ескалація до адміна
   */
  @Cron('0 4 * * *', {
    name: 'checkOverdue',
    timeZone: 'Europe/Kiev',
  })
  async handleOverdueCheck() {
    this.logger.log('🔄 Starting overdue invoice check...');
    
    try {
      await this.billingService.checkOverdueInvoices();
      this.logger.log('✅ Overdue check complete');
    } catch (error) {
      this.logger.error('❌ Overdue check failed:', error);
    }
  }

  /**
   * Щогодинна перевірка нових підписок
   * Для швидшого реагування на нові записи
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'quickBillingCheck',
  })
  async handleHourlyCheck() {
    this.logger.debug('Running hourly billing check...');
    
    try {
      // Перевіряємо тільки сьогоднішні підписки
      const generated = await this.billingService.checkAndGenerateInvoices();
      if (generated > 0) {
        this.logger.log(`Generated ${generated} invoices during hourly check`);
      }
    } catch (error) {
      this.logger.error('Hourly billing check failed:', error);
    }
  }

  /**
   * F4 FIX: Renewal CRON — щодня о 2:00
   * Перевіряє підписки що закінчуються через 5 днів:
   * - autoRenew=true → створює renewal invoice + RENEWAL_SOON
   * - autoRenew=false → створює renewal invoice + RENEWAL_SOON + notification
   * Маркує прострочені як EXPIRED
   */
  @Cron('0 2 * * *', {
    name: 'renewalCheck',
    timeZone: 'Europe/Kiev',
  })
  async handleRenewalCheck() {
    this.logger.log('🔄 Starting renewal check...');
    
    try {
      // This calls SubscriptionsService.checkRenewals() which is now canonical
      const result = await this.billingService.runRenewalCheck();
      this.logger.log(`✅ Renewal check complete. Processed: ${result}`);
    } catch (error) {
      this.logger.error('❌ Renewal check failed:', error);
    }
  }
}
