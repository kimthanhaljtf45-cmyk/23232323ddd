import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoachPerformanceDocument = CoachPerformance & Document;

@Schema({ timestamps: true })
export class CoachPerformance {
  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  tenantId: string;

  // KPI Metrics (0-100)
  @Prop({ default: 0 })
  retentionRate: number; // 25%

  @Prop({ default: 0 })
  attendanceRate: number; // 20%

  @Prop({ default: 0 })
  resultsScore: number; // 20% (medals, competitions)

  @Prop({ default: 0 })
  revenueScore: number; // 15%

  @Prop({ default: 0 })
  feedbackScore: number; // 10% (parent ratings)

  @Prop({ default: 0 })
  activityScore: number; // 10% (comments, actions done)

  // Calculated Score (0-100)
  @Prop({ default: 0 })
  performanceScore: number;

  // Rank
  @Prop({ enum: ['TOP', 'GOOD', 'AVERAGE', 'AT_RISK'], default: 'AVERAGE' })
  rank: string;

  // Raw numbers
  @Prop({ default: 0 })
  totalStudents: number;

  @Prop({ default: 0 })
  totalGroups: number;

  @Prop({ default: 0 })
  churnedStudents: number;

  @Prop({ default: 0 })
  totalMedals: number;

  @Prop({ default: 0 })
  goldMedals: number;

  @Prop({ default: 0 })
  silverMedals: number;

  @Prop({ default: 0 })
  bronzeMedals: number;

  @Prop({ default: 0 })
  monthlyRevenue: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop({ default: 0 })
  avgRating: number;

  @Prop({ default: 0 })
  ratingsCount: number;

  @Prop({ default: 0 })
  actionsCompleted: number;

  @Prop({ default: 0 })
  commentsWritten: number;

  @Prop({ type: Date })
  calculatedAt: Date;
}

export const CoachPerformanceSchema = SchemaFactory.createForClass(CoachPerformance);
CoachPerformanceSchema.index({ coachId: 1, tenantId: 1 });
CoachPerformanceSchema.index({ performanceScore: -1 });
