import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club, ClubSchema } from '../../schemas/club.schema';
import { ClubMembership, ClubMembershipSchema } from '../../schemas/club-membership.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: ClubMembership.name, schema: ClubMembershipSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
