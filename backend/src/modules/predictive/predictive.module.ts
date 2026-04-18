import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PredictiveService } from './predictive.service';
import { PredictiveController } from './predictive.controller';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Child.name, schema: ChildSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
    ]),
  ],
  controllers: [PredictiveController],
  providers: [PredictiveService],
  exports: [PredictiveService],
})
export class PredictiveModule {}
