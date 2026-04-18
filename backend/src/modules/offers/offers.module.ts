import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Offer, OfferSchema } from '../../schemas/offer.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { RetentionSnapshot, RetentionSnapshotSchema } from '../../schemas/retention-snapshot.schema';
import { OffersService } from './offers.service';
import { OffersController, ParentOffersController, SystemOffersController } from './offers.controller';
import { AuthModule } from '../auth/auth.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: RetentionSnapshot.name, schema: RetentionSnapshotSchema },
    ]),
    AuthModule,
    DiscountsModule,
    NotificationsModule,
  ],
  controllers: [OffersController, ParentOffersController, SystemOffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
