import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachAction, CoachActionSchema } from '../../schemas/coach-action.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Alert, AlertSchema } from '../../schemas/alert.schema';
import { MessageThread, MessageThreadSchema } from '../../schemas/message-thread.schema';
import { CoachActionsService } from './coach-actions.service';
import { CoachActionsController } from './coach-actions.controller';
import { CoachActionsGenerator } from './coach-actions.generator';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoachAction.name, schema: CoachActionSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: MessageThread.name, schema: MessageThreadSchema },
    ]),
  ],
  providers: [CoachActionsService, CoachActionsGenerator],
  controllers: [CoachActionsController],
  exports: [CoachActionsService, CoachActionsGenerator],
})
export class CoachActionsModule {}
