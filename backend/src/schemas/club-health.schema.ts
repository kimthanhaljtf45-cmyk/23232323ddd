import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClubHealthDocument = ClubHealth & Document;

@Schema({ timestamps: true })
export class ClubHealth {
  @Prop({ required: true })
  tenantId: string;

  // Main Metrics (0-100)
  @Prop({ default: 0 })
  healthScore: number;

  @Prop({ enum: ['EXCELLENT', 'GOOD', 'WARNING', 'CRITICAL'], default: 'GOOD' })
  status: string;

  // Financial
  @Prop({ default: 0 })
  monthlyRevenue: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop({ default: 0 })
  avgRevenuePerStudent: number;

  @Prop({ default: 0 })
  paymentDiscipline: number; // % paid on time

  @Prop({ default: 0 })
  overdueAmount: number;

  // Students
  @Prop({ default: 0 })
  totalStudents: number;

  @Prop({ default: 0 })
  activeStudents: number;

  @Prop({ default: 0 })
  newThisMonth: number;

  @Prop({ default: 0 })
  churnedThisMonth: number;

  @Prop({ default: 0 })
  churnRate: number;

  @Prop({ default: 0 })
  retentionRate: number;

  // Attendance
  @Prop({ default: 0 })
  avgAttendance: number;

  // Coaches
  @Prop({ default: 0 })
  totalCoaches: number;

  @Prop({ default: 0 })
  avgCoachScore: number;

  @Prop({ default: 0 })
  topCoaches: number;

  @Prop({ default: 0 })
  atRiskCoaches: number;

  // Groups
  @Prop({ default: 0 })
  totalGroups: number;

  @Prop({ default: 0 })
  avgGroupFillRate: number;

  @Prop({ default: 0 })
  criticalGroups: number;

  // Competitions
  @Prop({ default: 0 })
  totalMedals: number;

  @Prop({ default: 0 })
  competitionParticipation: number;

  // Locations
  @Prop({ default: 0 })
  totalLocations: number;

  @Prop({ type: Date })
  calculatedAt: Date;
}

export const ClubHealthSchema = SchemaFactory.createForClass(ClubHealth);
ClubHealthSchema.index({ tenantId: 1 });
ClubHealthSchema.index({ healthScore: -1 });
