import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppliedDiscountDocument = AppliedDiscount & Document;

@Schema({ timestamps: true })
export class AppliedDiscount {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  discountRuleId: string;

  @Prop({ required: true })
  discountType: string; // REFERRAL, PROMO, etc.

  @Prop({ required: true })
  discountName: string;

  @Prop()
  ruleName?: string;

  @Prop({ required: true })
  originalAmount: number;

  @Prop({ required: true })
  discountAmount: number;

  @Prop({ required: true })
  finalAmount: number;

  @Prop()
  promoCode?: string;

  @Prop()
  invoiceId?: string;

  @Prop()
  bookingId?: string;

  @Prop()
  subscriptionId?: string;

  @Prop({ type: String, enum: ['BOOKING', 'SUBSCRIPTION', 'INVOICE'], required: true })
  context: string;

  @Prop({ type: String, enum: ['PENDING', 'USED', 'EXPIRED'], default: 'PENDING' })
  status: string;

  @Prop({ type: Date })
  usedAt?: Date;

  @Prop({ type: Date, default: Date.now })
  appliedAt: Date;
}

export const AppliedDiscountSchema = SchemaFactory.createForClass(AppliedDiscount);
