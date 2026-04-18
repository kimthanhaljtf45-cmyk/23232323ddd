import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../../schemas/payment-transaction.schema';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
    IntegrationsModule,
    SubscriptionsModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentsModule {}
