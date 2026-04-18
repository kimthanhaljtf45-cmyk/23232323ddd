import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { SubscriptionPlan, SubscriptionPlanSchema } from '../../schemas/subscription-plan.schema';
import { Plan, PlanSchema } from '../../schemas/plan.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Child.name, schema: ChildSchema },
    ]),
    forwardRef(() => InvoicesModule),
  ],
  controllers: [SubscriptionController, SubscriptionsController],
  providers: [SubscriptionService, SubscriptionsService],
  exports: [SubscriptionService, SubscriptionsService],
})
export class SubscriptionsModule {}
