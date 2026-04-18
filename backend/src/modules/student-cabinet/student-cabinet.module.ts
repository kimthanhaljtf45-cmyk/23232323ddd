import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentCabinetController } from './student-cabinet.controller';
import { StudentCabinetService } from './student-cabinet.service';
import { User, UserSchema } from '../../schemas/user.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Schedule, ScheduleSchema } from '../../schemas/schedule.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { ProgressSnapshot, ProgressSnapshotSchema } from '../../schemas/progress-snapshot.schema';
import { CompetitionResult, CompetitionResultSchema } from '../../schemas/competition-result.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Group.name, schema: GroupSchema },
      { name: ProgressSnapshot.name, schema: ProgressSnapshotSchema },
      { name: CompetitionResult.name, schema: CompetitionResultSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [StudentCabinetController],
  providers: [StudentCabinetService],
  exports: [StudentCabinetService],
})
export class StudentCabinetModule {}
