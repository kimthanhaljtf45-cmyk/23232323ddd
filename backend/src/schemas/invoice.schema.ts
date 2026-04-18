import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  parentId: string;

  @Prop()
  clubId: string;

  @Prop()
  subscriptionId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop({ default: 'Оплата за тренування' })
  description: string;

  @Prop({ default: 'PENDING', enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] })
  status: string;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  paidAt: Date;

  @Prop()
  proofUrl: string;

  @Prop()
  adminNote: string;

  @Prop({ default: false })
  overdueReminderSent: boolean;

  @Prop({ default: false })
  escalationSent: boolean;

  // WayForPay integration fields
  @Prop()
  wayforpayOrderReference: string;

  @Prop()
  wayforpayOrderDate: number;

  @Prop()
  wayforpayTransactionId: string;

  @Prop()
  wayforpayCardPan: string;

  @Prop()
  wayforpayPaymentSystem: string;

  @Prop()
  wayforpayFee: number;

  @Prop()
  wayforpayLastError: string;

  @Prop()
  wayforpayLastErrorCode: number;

  // Discount tracking
  @Prop()
  finalAmount: number;

  @Prop()
  discountAmount: number;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// Club-scope plugin: auto-filters by clubId
import { clubScopePlugin } from '../common/plugins/club-scope.plugin';
InvoiceSchema.plugin(clubScopePlugin);

// Indexes
InvoiceSchema.index({ parentId: 1, status: 1 });
InvoiceSchema.index({ wayforpayOrderReference: 1 });
