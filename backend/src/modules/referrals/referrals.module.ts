import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferralsService } from './referrals.service';
import { ReferralsController, AdminReferralsController } from './referrals.controller';
import { Referral, ReferralSchema } from '../../schemas/referral.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { DiscountsModule } from '../discounts/discounts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => DiscountsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
