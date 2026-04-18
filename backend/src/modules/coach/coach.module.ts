import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';
import { CoachInsightsService } from './coach-insights.service';
import { CoachAnalyticsService } from './coach-analytics.service';
import { Schedule, ScheduleSchema } from '../../schemas/schedule.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { CoachAction, CoachActionSchema } from '../../schemas/coach-action.schema';
import { Progress, ProgressSchema } from '../../schemas/progress.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { CompetitionsModule } from '../competitions/competitions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: CoachAction.name, schema: CoachActionSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    forwardRef(() => CompetitionsModule),
  ],
  controllers: [CoachController],
  providers: [CoachService, CoachInsightsService, CoachAnalyticsService],
  exports: [CoachService, CoachInsightsService, CoachAnalyticsService],
})
export class CoachModule {}
