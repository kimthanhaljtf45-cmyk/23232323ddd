import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

/**
 * SUBSCRIPTION SCHEMA - Student Subscriptions
 * 
 * Status flow:
 * ACTIVE → PAUSED → ACTIVE (resume)
 * ACTIVE → CANCELLED
 * ACTIVE → RENEWAL_SOON → ACTIVE (renewed) | EXPIRED
 */

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  parentId: string;

  @Prop()
  clubId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ default: 'Місячний абонемент' })
  planName: string;

  @Prop({ required: true, enum: ['MONTH', 'HALF_YEAR', 'YEAR'] })
  planType: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ required: true })
  finalPrice: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ 
    default: 'ACTIVE', 
    enum: ['PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'RENEWAL_SOON'] 
  })
  status: string;

  @Prop({ type: Date })
  nextBillingDate: Date;

  @Prop({ type: Date })
  lastBilledAt: Date;

  // Freeze functionality
  @Prop({ default: false })
  isFrozen: boolean;

  @Prop({ type: Date })
  freezeStart: Date;

  @Prop({ type: Date })
  freezeEnd: Date;

  @Prop({ default: 0 })
  freezeDaysUsed: number;

  @Prop({ default: 0 })
  freezeDaysAllowed: number;

  @Prop()
  freezeReason: string;

  // Group association
  @Prop()
  groupId: string;

  @Prop()
  groupName: string;

  // Coach
  @Prop()
  coachId: string;

  // Renewal tracking
  @Prop({ default: false })
  autoRenew: boolean;

  @Prop({ default: false })
  renewalReminderSent: boolean;

  @Prop()
  cancelledReason: string;

  @Prop({ type: Date })
  cancelledAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Club-scope plugin: auto-filters by clubId
import { clubScopePlugin } from '../common/plugins/club-scope.plugin';
SubscriptionSchema.plugin(clubScopePlugin);

// Indexes
SubscriptionSchema.index({ childId: 1, status: 1 });
SubscriptionSchema.index({ parentId: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ groupId: 1 });
