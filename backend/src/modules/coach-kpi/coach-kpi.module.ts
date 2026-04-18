import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachKPIService } from './coach-kpi.service';
import { CoachKPIController } from './coach-kpi.controller';
import { CoachKPI, CoachKPISchema } from '../../schemas/coach-kpi.schema';
import { Consultation, ConsultationSchema } from '../../schemas/consultation.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { ClubMembership, ClubMembershipSchema } from '../../schemas/club-membership.schema';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoachKPI.name, schema: CoachKPISchema },
      { name: Consultation.name, schema: ConsultationSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: ClubMembership.name, schema: ClubMembershipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CoachKPIController],
  providers: [CoachKPIService],
  exports: [CoachKPIService],
})
export class CoachKPIModule {}
