import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubBillingService } from './club-billing.service';
import { ClubBillingController } from './club-billing.controller';
import { ClubSubscription, ClubSubscriptionSchema } from '../../schemas/club-subscription.schema';
import { ClubInvoice, ClubInvoiceSchema } from '../../schemas/club-invoice.schema';
import { Club, ClubSchema } from '../../schemas/club.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ClubMembership, ClubMembershipSchema } from '../../schemas/club-membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubSubscription.name, schema: ClubSubscriptionSchema },
      { name: ClubInvoice.name, schema: ClubInvoiceSchema },
      { name: Club.name, schema: ClubSchema },
      { name: Child.name, schema: ChildSchema },
      { name: ClubMembership.name, schema: ClubMembershipSchema },
    ]),
  ],
  controllers: [ClubBillingController],
  providers: [ClubBillingService],
  exports: [ClubBillingService],
})
export class ClubBillingModule {}
