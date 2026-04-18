import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { SmsMockService } from './sms-mock.service';
import { SmsTurboSmsService } from './sms-turbosms.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SmsService, SmsMockService, SmsTurboSmsService],
  exports: [SmsService],
})
export class SmsModule {}
