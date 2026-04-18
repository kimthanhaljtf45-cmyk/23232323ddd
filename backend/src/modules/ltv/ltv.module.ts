import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LtvService } from './ltv.service';
import { LtvEngineService } from './ltv-engine.service';
import { LtvController } from './ltv.controller';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { StudentLtv, StudentLtvSchema } from '../../schemas/student-ltv.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Child.name, schema: ChildSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Group.name, schema: GroupSchema },
      { name: StudentLtv.name, schema: StudentLtvSchema },
    ]),
  ],
  controllers: [LtvController],
  providers: [LtvService, LtvEngineService],
  exports: [LtvService, LtvEngineService],
})
export class LtvModule {}
