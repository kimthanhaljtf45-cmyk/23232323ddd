import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type StudentLtvDocument = StudentLtv & Document;

/**
 * Student LTV (Lifetime Value) Schema
 * 
 * Stores LTV metrics for each student:
 * - totalPaid: actual revenue from this student
 * - totalDiscounts: discounts given
 * - LTV_actual: totalPaid - totalDiscounts
 * - LTV_predicted: avgMonthly * predictedMonthsLeft
 */
@Schema({ timestamps: true })
export class StudentLtv {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Child', unique: true })
  childId: string;

  // Revenue metrics
  @Prop({ default: 0 })
  totalPaid: number;

  @Prop({ default: 0 })
  totalDiscounts: number;

  @Prop({ default: 0 })
  monthsActive: number;

  @Prop({ default: 0 })
  avgMonthlyPayment: number;

  // Prediction metrics
  @Prop({ default: 0 })
  churnProbability: number; // 0-100

  @Prop({ default: 12 })
  predictedMonthsLeft: number;

  // LTV Calculations
  @Prop({ default: 0 })
  ltvActual: number; // totalPaid - totalDiscounts

  @Prop({ default: 0 })
  ltvPredicted: number; // avgMonthly * predictedMonthsLeft

  @Prop({ default: 0 })
  ltvTotal: number; // ltvActual + ltvPredicted

  // Last update
  @Prop()
  updatedAt?: Date;
}

export const StudentLtvSchema = SchemaFactory.createForClass(StudentLtv);
