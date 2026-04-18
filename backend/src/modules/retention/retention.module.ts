import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RetentionSnapshot, RetentionSnapshotSchema } from '../../schemas/retention-snapshot.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Progress, ProgressSchema } from '../../schemas/progress.schema';
import { Alert, AlertSchema } from '../../schemas/alert.schema';
import { CompetitionResult, CompetitionResultSchema } from '../../schemas/competition-result.schema';
import { CompetitionParticipant, CompetitionParticipantSchema } from '../../schemas/competition-participant.schema';
import { Competition, CompetitionSchema } from '../../schemas/competition.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { RetentionService } from './retention.service';
import { RetentionEngine } from './retention.engine';
import { RetentionController } from './retention.controller';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RetentionSnapshot.name, schema: RetentionSnapshotSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: CompetitionResult.name, schema: CompetitionResultSchema },
      { name: CompetitionParticipant.name, schema: CompetitionParticipantSchema },
      { name: Competition.name, schema: CompetitionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    AlertsModule,
  ],
  providers: [RetentionService, RetentionEngine],
  controllers: [RetentionController],
  exports: [RetentionService, RetentionEngine],
})
export class RetentionModule {}
