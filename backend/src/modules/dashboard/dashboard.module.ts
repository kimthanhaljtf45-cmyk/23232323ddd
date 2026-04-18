import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardBlocksService } from './dashboard-blocks.service';

import { ParentKidsBuilder } from './builders/parent-kids.builder';
import { ParentSpecialBuilder } from './builders/parent-special.builder';
import { StudentKidsBuilder } from './builders/student-kids.builder';
import { StudentAdultBuilder } from './builders/student-adult.builder';
import { CoachDashboardBuilder } from './builders/coach-dashboard.builder';
import { AdminDashboardBuilder } from './builders/admin-dashboard.builder';
import { ConsultationDashboardBuilder } from './builders/consultation-dashboard.builder';

import { User, UserSchema } from '../../schemas/user.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Schedule, ScheduleSchema } from '../../schemas/schedule.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { ContentPost, ContentPostSchema } from '../../schemas/content-post.schema';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { Achievement, AchievementSchema } from '../../schemas/achievement.schema';
import { CoachComment, CoachCommentSchema } from '../../schemas/coach-comment.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { ProgressSnapshot, ProgressSnapshotSchema } from '../../schemas/progress-snapshot.schema';
import { MessageThread, MessageThreadSchema } from '../../schemas/message-thread.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Child.name, schema: ChildSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ContentPost.name, schema: ContentPostSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: CoachComment.name, schema: CoachCommentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ProgressSnapshot.name, schema: ProgressSnapshotSchema },
      { name: MessageThread.name, schema: MessageThreadSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardBlocksService,
    ParentKidsBuilder,
    ParentSpecialBuilder,
    StudentKidsBuilder,
    StudentAdultBuilder,
    CoachDashboardBuilder,
    AdminDashboardBuilder,
    ConsultationDashboardBuilder,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
