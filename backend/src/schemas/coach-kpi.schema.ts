import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CoachKPIDocument = HydratedDocument<CoachKPI>;

@Schema({ timestamps: true })
export class CoachKPI {
  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  clubId: string;

  @Prop()
  coachName: string;

  @Prop({ default: 0 })
  attendanceRate: number;

  @Prop({ default: 0 })
  retentionRate: number;

  @Prop({ default: 0 })
  conversionRate: number;

  @Prop({ default: 0 })
  actionsCount: number;

  @Prop({ default: 0 })
  avgResponseMinutes: number;

  @Prop({ default: 0 })
  studentsCount: number;

  @Prop({ default: 0 })
  groupsCount: number;

  @Prop({ default: 0 })
  leadsHandled: number;

  @Prop({ default: 0 })
  leadsConverted: number;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 1 })
  rank: number;

  @Prop({ default: 'STABLE', enum: ['UP', 'DOWN', 'STABLE'] })
  trend: string;

  @Prop()
  period: string;

  @Prop()
  previousScore: number;
}

export const CoachKPISchema = SchemaFactory.createForClass(CoachKPI);
CoachKPISchema.index({ clubId: 1, score: -1 });
CoachKPISchema.index({ coachId: 1, period: 1 }, { unique: true });
