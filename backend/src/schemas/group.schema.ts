import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProgramType } from '../domain/enums';

export type GroupDocument = HydratedDocument<Group>;

@Schema()
export class GroupScheduleItem {
  @Prop({ required: true })
  day: string; // MON, TUE, WED, THU, FRI, SAT, SUN

  @Prop({ required: true })
  time: string; // 18:00
}

export const GroupScheduleItemSchema = SchemaFactory.createForClass(GroupScheduleItem);

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({
    required: true,
    enum: ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'],
    default: 'KIDS',
  })
  programType: ProgramType;

  @Prop()
  ageRange?: string;

  @Prop()
  level?: string;

  @Prop({ default: 15 })
  capacity: number;

  @Prop()
  description?: string;

  @Prop()
  locationId?: string;

  @Prop({ type: [GroupScheduleItemSchema], default: [] })
  schedule: GroupScheduleItem[];

  @Prop({ default: 12 })
  monthlyTrainingsTarget: number;

  @Prop({ required: true, default: 2000 })
  monthlyPrice: number;

  @Prop({ default: true })
  isActive: boolean;

  // ===== P5: MARKETPLACE FIELDS =====

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: 0 })
  fillRate: number; // calculated: (studentsCount / capacity) * 100

  @Prop({ default: 0 })
  ratingScore: number; // derived from coach + attendance + fillRate

  @Prop({ default: 0 })
  priorityBoost: number; // manual admin boost for ranking

  @Prop({ default: true })
  autoAssignEnabled: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Club-scope plugin: auto-filters by clubId
import { clubScopePlugin } from '../common/plugins/club-scope.plugin';
GroupSchema.plugin(clubScopePlugin);
