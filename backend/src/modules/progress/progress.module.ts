import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Achievement, AchievementSchema } from '../../schemas/achievement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Achievement.name, schema: AchievementSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
