import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { CompetitionResult, CompetitionResultSchema } from '../../schemas/competition-result.schema';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: CompetitionResult.name, schema: CompetitionResultSchema },
    ]),
    forwardRef(() => DiscountsModule),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoicesModule {}
