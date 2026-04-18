import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingReconciliationService } from './billing-reconciliation.service';
import { BillingReconciliationController } from './billing-reconciliation.controller';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Alert, AlertSchema } from '../../schemas/alert.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  controllers: [BillingReconciliationController],
  providers: [BillingReconciliationService],
  exports: [BillingReconciliationService],
})
export class BillingReconciliationModule {}
