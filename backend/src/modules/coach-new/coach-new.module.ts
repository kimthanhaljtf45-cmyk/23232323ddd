import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CoachNewController } from './coach-new.controller';
import { CoachNewService } from './coach-new.service';

import {
  CoachProfile,
  CoachProfileSchema,
} from '../../schemas/coach-profile.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoachProfile.name, schema: CoachProfileSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Location.name, schema: LocationSchema },
    ]),
  ],
  controllers: [CoachNewController],
  providers: [CoachNewService],
  exports: [CoachNewService],
})
export class CoachNewModule {}
