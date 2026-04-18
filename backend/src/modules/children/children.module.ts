import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Achievement, AchievementSchema } from '../../schemas/achievement.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Child.name, schema: ChildSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Location.name, schema: LocationSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [ChildrenController],
  providers: [ChildrenService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
