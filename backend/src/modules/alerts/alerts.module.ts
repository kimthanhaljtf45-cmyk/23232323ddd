import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Alert, AlertSchema } from '../../schemas/alert.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Consultation, ConsultationSchema } from '../../schemas/consultation.schema';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertsEngine } from './alerts.engine';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Alert.name, schema: AlertSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    ScheduleModule.forRoot(),
  ],
  providers: [AlertsService, AlertsEngine],
  controllers: [AlertsController],
  exports: [AlertsService, AlertsEngine, MongooseModule],
})
export class AlertsModule {}
