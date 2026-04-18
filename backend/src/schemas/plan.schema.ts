import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

/**
 * PLAN SCHEMA - Subscription Plans
 * 
 * Types:
 * - MONTH (1 місяць)
 * - HALF_YEAR (6 місяців, -10%)
 * - YEAR (12 місяців, -20%)
 */

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true })
  name: string; // 'Місяць', '6 місяців', 'Рік'

  @Prop({ required: true, enum: ['MONTH', 'HALF_YEAR', 'YEAR'] })
  type: string;

  @Prop({ required: true })
  durationMonths: number; // 1, 6, 12

  @Prop({ required: true })
  basePrice: number; // Базова ціна (без знижки)

  @Prop({ default: 0 })
  discountPercent: number; // 0, 10, 20

  @Prop({ required: true })
  finalPrice: number; // Фінальна ціна після знижки

  @Prop({ default: 0 })
  freezeDaysAllowed: number; // Дозволено днів заморозки

  @Prop({ default: 0 })
  personalSessionsIncluded: number; // Персональних тренувань включено

  @Prop({ default: false })
  competitionBenefits: boolean; // Пільги на змагання

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  programType?: string; // KIDS, SELF_DEFENSE, SPECIAL, etc.

  @Prop()
  branchId?: string; // Якщо план прив'язаний до філії

  @Prop({ default: 0 })
  sortOrder: number;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

// Indexes
PlanSchema.index({ type: 1, isActive: 1 });
PlanSchema.index({ programType: 1 });
