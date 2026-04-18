import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RetentionSnapshotDocument = HydratedDocument<RetentionSnapshot>;

export type RetentionEntityType = 'CHILD' | 'PARENT' | 'STUDENT';
export type EngagementStatus = 'good' | 'warning' | 'critical' | 'stable';
export type DropOffRisk = 'low' | 'warning' | 'critical';

@Schema({ timestamps: true })
export class RetentionSnapshot {
  @Prop({ required: true })
  entityId: string; // childId or userId

  @Prop({ required: true })
  entityType: RetentionEntityType;

  @Prop({ default: 0 })
  streak: number;

  @Prop({ default: 0 })
  monthlyGoalCurrent: number;

  @Prop({ default: 12 })
  monthlyGoalTarget: number;

  @Prop({ default: 'stable' })
  engagementStatus: EngagementStatus;

  @Prop({ default: 'low' })
  dropOffRisk: DropOffRisk;

  @Prop({ type: Object })
  nextMilestone?: {
    type: string;
    title: string;
    progress?: number;
  };

  @Prop({ type: [Object], default: [] })
  recentAchievements: Array<{
    type: string;
    title: string;
    awardedAt: Date;
  }>;

  @Prop({ type: [Object], default: [] })
  recommendations: Array<{
    type: string;
    title: string;
  }>;

  @Prop({ default: 0 })
  totalTrainingsThisMonth: number;

  @Prop({ default: 0 })
  attendanceRate: number;

  @Prop()
  lastVisitDate?: Date;

  @Prop()
  daysSinceLastVisit?: number;

  @Prop({ default: 0 })
  riskScore: number; // 0-100, higher = more at risk
}

export const RetentionSnapshotSchema = SchemaFactory.createForClass(RetentionSnapshot);

// Indexes
RetentionSnapshotSchema.index({ entityId: 1, entityType: 1 }, { unique: true });
RetentionSnapshotSchema.index({ dropOffRisk: 1 });
RetentionSnapshotSchema.index({ riskScore: -1 });
