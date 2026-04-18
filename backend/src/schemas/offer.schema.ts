import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OfferDocument = Offer & Document;

export type OfferType = 'CRITICAL_SAVE' | 'MEDIUM_SAVE' | 'LOYALTY_REWARD' | 'FAMILY_BONUS' | 'MANUAL';
export type OfferStatus = 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';

@Schema({ timestamps: true })
export class Offer {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true })
  studentId: string; // childId or userId

  @Prop()
  parentId?: string;

  @Prop({ required: true, enum: ['CRITICAL_SAVE', 'MEDIUM_SAVE', 'LOYALTY_REWARD', 'FAMILY_BONUS', 'MANUAL'] })
  type: OfferType;

  @Prop({ required: true })
  discountPercent: number;

  @Prop({ required: true })
  title: string;

  @Prop()
  message?: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ type: String, enum: ['ACTIVE', 'ACCEPTED', 'EXPIRED', 'REJECTED'], default: 'ACTIVE' })
  status: OfferStatus;

  @Prop({ default: false })
  accepted: boolean;

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop()
  appliedInvoiceId?: string;

  @Prop()
  discountRuleId?: string;

  @Prop({ default: 0 })
  riskScore: number;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
