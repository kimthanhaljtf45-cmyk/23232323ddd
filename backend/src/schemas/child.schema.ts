import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProgramType } from '../domain/enums';

export type ChildDocument = HydratedDocument<Child>;

@Schema({ timestamps: true })
export class Child {
  @Prop({ required: true })
  firstName: string;

  @Prop()
  lastName?: string;

  @Prop()
  birthDate?: string;

  @Prop({ default: 'ACTIVE' })
  status: string;

  @Prop()
  note?: string;

  // === CORE RELATIONSHIPS (Club → Group → Coach → Child) ===
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  coachId: string;

  // Parent owner (for kids program)
  @Prop()
  parentId?: string;

  // Owner of this profile (parent or self-student)
  @Prop({ required: true })
  roleOwnerId: string;

  // Legacy fields for backward compatibility
  @Prop()
  userId?: string;

  @Prop()
  telegramId?: string;

  // === PROGRAM & PROGRESS ===
  @Prop({
    required: true,
    enum: ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'],
    default: 'KIDS',
  })
  programType: ProgramType;

  @Prop({ default: 'WHITE' })
  belt: string;

  @Prop({ default: false })
  coachApprovedForNextBelt: boolean;

  @Prop()
  approvedByCoachId?: string;

  @Prop()
  approvalDate?: Date;

  @Prop({ default: 12 })
  monthlyGoalTarget: number;

  @Prop()
  coachCommentSummary?: string;

  @Prop()
  beltAwardedAt?: Date;

  @Prop()
  beltAwardedBy?: string;

  @Prop()
  age?: number;

  // Competition/Tournament Stats
  @Prop({ default: 0 })
  tournamentPoints: number;

  @Prop({ default: 0 })
  goldMedals: number;

  @Prop({ default: 0 })
  silverMedals: number;

  @Prop({ default: 0 })
  bronzeMedals: number;

  @Prop({ default: true })
  isActive: boolean;

  // === DEBT TRACKING ===
  @Prop({ default: false })
  hasDebt: boolean;

  @Prop({ default: 0 })
  debtAmount: number;
}

export const ChildSchema = SchemaFactory.createForClass(Child);

// Club-scope plugin: auto-filters by clubId
import { clubScopePlugin } from '../common/plugins/club-scope.plugin';
ChildSchema.plugin(clubScopePlugin);
