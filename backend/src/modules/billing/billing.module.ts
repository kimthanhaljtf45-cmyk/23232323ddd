import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCron } from './billing.cron';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, BillingCron],
  exports: [BillingService],
})
export class BillingModule {}
