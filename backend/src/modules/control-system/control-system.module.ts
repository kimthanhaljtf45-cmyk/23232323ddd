import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ControlSystemService } from './control-system.service';
import { ControlSystemController } from './control-system.controller';
import { GroupHealth, GroupHealthSchema } from '../../schemas/group-health.schema';
import { CoachPerformance, CoachPerformanceSchema } from '../../schemas/coach-performance.schema';
import { ClubHealth, ClubHealthSchema } from '../../schemas/club-health.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Tenant, TenantSchema } from '../../schemas/tenant.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GroupHealth.name, schema: GroupHealthSchema },
      { name: CoachPerformance.name, schema: CoachPerformanceSchema },
      { name: ClubHealth.name, schema: ClubHealthSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Location.name, schema: LocationSchema },
    ]),
  ],
  controllers: [ControlSystemController],
  providers: [ControlSystemService],
  exports: [ControlSystemService],
})
export class ControlSystemModule {}
