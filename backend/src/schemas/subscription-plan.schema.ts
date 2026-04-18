import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

/**
 * SUBSCRIPTION PLAN SCHEMA
 * 
 * Re-export of Plan with naming compatible with subscription module.
 * Types:
 * - MONTH (1 місяць)
 * - HALF_YEAR (6 місяців, -10%)
 * - YEAR (12 місяців, -20%)
 */

@Schema({ timestamps: true, collection: 'plans' })
export class SubscriptionPlan {
  @Prop({ required: true })
  name: string; // 'Місяць', '6 місяців', 'Рік'

  @Prop({ required: true, enum: ['MONTH', 'HALF_YEAR', 'YEAR'] })
  type: string;

  @Prop({ required: true })
  durationMonths: number; // 1, 6, 12

  @Prop({ required: true })
  basePrice: number;

  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ required: true })
  finalPrice: number;

  @Prop({ default: 0 })
  freezeDaysAllowed: number;

  @Prop({ default: 0 })
  personalSessionsIncluded: number;

  @Prop({ default: false })
  competitionBenefits: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  programType?: string;

  @Prop()
  branchId?: string;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);

SubscriptionPlanSchema.index({ planType: 1, isActive: 1 });
SubscriptionPlanSchema.index({ programType: 1 });
