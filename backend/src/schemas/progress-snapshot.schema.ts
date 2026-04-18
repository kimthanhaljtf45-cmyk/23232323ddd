import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProgressSnapshotDocument = HydratedDocument<ProgressSnapshot>;

@Schema({ timestamps: true })
export class ProgressSnapshot {
  @Prop({ required: true })
  childId: string;

  @Prop()
  groupId?: string;

  @Prop({ required: true })
  currentBelt: string;

  @Prop()
  nextBelt?: string;

  @Prop({ default: 0 })
  progressPercent: number;

  @Prop({ default: 0 })
  attendancePercent: number;

  @Prop({ default: 0 })
  disciplineScore: number;

  @Prop({ default: 0 })
  streak: number;

  @Prop({ default: 'stable' })
  trend: string;

  @Prop({ default: 0 })
  presentCount: number;

  @Prop({ default: 0 })
  absentCount: number;

  @Prop({ default: 0 })
  warnedCount: number;

  @Prop({ default: 0 })
  lateCount: number;

  @Prop({ default: 0 })
  monthlyGoalCurrent: number;

  @Prop({ default: 12 })
  monthlyGoalTarget: number;

  @Prop({ default: 0 })
  monthsInCurrentBelt: number;

  @Prop({ default: false })
  coachApproved: boolean;

  @Prop()
  estimatedReady?: Date;
}

export const ProgressSnapshotSchema = SchemaFactory.createForClass(ProgressSnapshot);
