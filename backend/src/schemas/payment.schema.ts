import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export type PaymentStatus = 'PENDING' | 'UNDER_REVIEW' | 'PAID' | 'REJECTED';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop()
  description?: string;

  @Prop({ default: 'PENDING' })
  status: PaymentStatus;

  @Prop()
  dueDate?: string;

  @Prop()
  paidAt?: string;

  @Prop()
  proofUrl?: string;

  @Prop()
  approvedById?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
