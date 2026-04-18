import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentTransactionDocument = PaymentTransaction & Document;

/**
 * PAYMENT TRANSACTION SCHEMA
 * 
 * Tracks all payment attempts and their results.
 * This is the audit log for all money movements.
 */

@Schema({ timestamps: true })
export class PaymentTransaction {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true })
  invoiceId: string;

  @Prop({ required: true })
  provider: string; // 'WAYFORPAY', 'LIQPAY', 'MANUAL'

  @Prop({ default: 'TEST', enum: ['TEST', 'LIVE'] })
  mode: string;

  @Prop()
  externalReference: string; // Provider's transaction ID

  @Prop({ type: Object })
  requestPayload: Record<string, any>;

  @Prop({ type: Object })
  callbackPayload: Record<string, any>;

  @Prop({ 
    required: true, 
    enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'CREATED'
  })
  status: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop()
  errorCode: string;

  @Prop()
  errorMessage: string;

  @Prop({ type: Date })
  completedAt: Date;
}

export const PaymentTransactionSchema = SchemaFactory.createForClass(PaymentTransaction);

// Indexes
PaymentTransactionSchema.index({ invoiceId: 1 });
PaymentTransactionSchema.index({ externalReference: 1 });
PaymentTransactionSchema.index({ tenantId: 1, status: 1 });
