import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetaBrainService } from './meta-brain.service';
import { MetaBrainEngine } from './meta-brain.engine';
import { MetaBrainController } from './meta-brain.controller';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Progress, ProgressSchema } from '../../schemas/progress.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { CoachAction, CoachActionSchema } from '../../schemas/coach-action.schema';
import { DiscountsModule } from '../discounts/discounts.module';
import { GrowthEngineModule } from '../growth-engine/growth-engine.module';
import { LtvModule } from '../ltv/ltv.module';
import { PredictiveModule } from '../predictive/predictive.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: Group.name, schema: GroupSchema },
      { name: CoachAction.name, schema: CoachActionSchema },
    ]),
    forwardRef(() => DiscountsModule),
    forwardRef(() => GrowthEngineModule),
    forwardRef(() => LtvModule),
    forwardRef(() => PredictiveModule),
  ],
  controllers: [MetaBrainController],
  providers: [MetaBrainService, MetaBrainEngine],
  exports: [MetaBrainService, MetaBrainEngine],
})
export class MetaBrainModule {}
