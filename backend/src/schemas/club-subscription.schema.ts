import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubSubscriptionDocument = HydratedDocument<ClubSubscription>;

@Schema({ timestamps: true })
export class ClubSubscription {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true, enum: ['START', 'PRO', 'ENTERPRISE'] })
  plan: string;

  @Prop({ required: true, enum: ['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIAL'], default: 'ACTIVE' })
  status: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  nextBillingDate: Date;

  @Prop({ type: Date })
  lastBilledAt: Date;

  @Prop({ default: true })
  autoRenew: boolean;

  @Prop({ type: Date })
  canceledAt: Date;

  @Prop()
  cancelReason: string;
}

export const ClubSubscriptionSchema = SchemaFactory.createForClass(ClubSubscription);
ClubSubscriptionSchema.index({ clubId: 1 });
ClubSubscriptionSchema.index({ status: 1, nextBillingDate: 1 });
