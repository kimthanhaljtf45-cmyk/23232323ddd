import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscountsService } from './discounts.service';
import { DiscountsController, AdminDiscountsController } from './discounts.controller';
import { DiscountRule, DiscountRuleSchema } from '../../schemas/discount-rule.schema';
import { AppliedDiscount, AppliedDiscountSchema } from '../../schemas/applied-discount.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiscountRule.name, schema: DiscountRuleSchema },
      { name: AppliedDiscount.name, schema: AppliedDiscountSchema },
      { name: User.name, schema: UserSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [DiscountsController, AdminDiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
