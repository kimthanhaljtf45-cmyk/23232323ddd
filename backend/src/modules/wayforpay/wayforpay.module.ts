import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WayForPayService } from './wayforpay.service';
import { WayForPayController } from './wayforpay.controller';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { AppliedDiscount, AppliedDiscountSchema } from '../../schemas/applied-discount.schema';
import { Referral, ReferralSchema } from '../../schemas/referral.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: AppliedDiscount.name, schema: AppliedDiscountSchema },
      { name: Referral.name, schema: ReferralSchema },
    ]),
    NotificationsModule,
    CommunicationModule,
    forwardRef(() => DiscountsModule),
  ],
  controllers: [WayForPayController],
  providers: [WayForPayService],
  exports: [WayForPayService],
})
export class WayForPayModule {}
