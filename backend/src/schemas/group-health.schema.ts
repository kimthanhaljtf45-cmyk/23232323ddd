import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GroupHealthDocument = GroupHealth & Document;

@Schema({ timestamps: true })
export class GroupHealth {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  coachId: string;

  // Metrics (0-100)
  @Prop({ default: 0 })
  attendanceRate: number;

  @Prop({ default: 0 })
  retentionRate: number;

  @Prop({ default: 0 })
  paymentDiscipline: number;

  @Prop({ default: 0 })
  progressRate: number;

  @Prop({ default: 0 })
  competitionParticipation: number;

  // Calculated Score (0-100)
  @Prop({ default: 0 })
  healthScore: number;

  // Status
  @Prop({ enum: ['EXCELLENT', 'GOOD', 'WARNING', 'CRITICAL'], default: 'GOOD' })
  status: string;

  // Raw numbers
  @Prop({ default: 0 })
  totalStudents: number;

  @Prop({ default: 0 })
  activeStudents: number;

  @Prop({ default: 0 })
  churnedThisMonth: number;

  @Prop({ default: 0 })
  newThisMonth: number;

  @Prop({ default: 0 })
  avgAttendancePercent: number;

  @Prop({ default: 0 })
  paidOnTime: number;

  @Prop({ default: 0 })
  overduePayments: number;

  @Prop({ type: Date })
  calculatedAt: Date;
}

export const GroupHealthSchema = SchemaFactory.createForClass(GroupHealth);
GroupHealthSchema.index({ groupId: 1, tenantId: 1 });
GroupHealthSchema.index({ healthScore: 1 });
