import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachTrainingController } from './coach-training.controller';
import { CoachTrainingService } from './coach-training.service';
import { TrainingSession, TrainingSessionSchema } from '../../schemas/training-session.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingSession.name, schema: TrainingSessionSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Location.name, schema: LocationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CoachTrainingController],
  providers: [CoachTrainingService],
  exports: [CoachTrainingService],
})
export class CoachTrainingModule {}
