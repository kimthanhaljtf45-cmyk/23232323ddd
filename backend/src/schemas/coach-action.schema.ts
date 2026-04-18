import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CoachActionDocument = HydratedDocument<CoachAction>;

export type CoachActionSeverity = 'info' | 'warning' | 'critical';
export type CoachActionStatus = 'OPEN' | 'DONE' | 'SNOOZED';
export type CoachActionType =
  // Attendance
  | 'CLOSE_ATTENDANCE'
  | 'CHECK_ABSENCES'
  | 'REVIEW_WARNED'
  // Progress
  | 'CONFIRM_BELT'
  | 'LEAVE_COMMENT'
  | 'REVIEW_STAGNATION'
  | 'REVIEW_CHILD_RISK'
  // Communication
  | 'REPLY_PARENT'
  | 'GIVE_FEEDBACK'
  // Tournament
  | 'REGISTER_STUDENT'
  | 'ENTER_RESULT'
  // Finance
  | 'PAYMENT_BLOCKED'
  | 'CONTACT_ADMIN';

@Schema({ timestamps: true })
export class CoachAction {
  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  type: CoachActionType;

  @Prop({ required: true, default: 'warning' })
  severity: CoachActionSeverity;

  @Prop({ required: true })
  title: string;

  @Prop()
  message?: string;

  @Prop()
  childId?: string;

  @Prop()
  groupId?: string;

  @Prop()
  parentId?: string;

  @Prop()
  alertId?: string;

  @Prop()
  screen?: string;

  @Prop({ type: Object })
  params?: Record<string, any>;

  @Prop({ default: 'OPEN' })
  status: CoachActionStatus;

  @Prop()
  snoozedUntil?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  completedBy?: string;

  @Prop({ type: Object })
  meta?: Record<string, any>;
}

export const CoachActionSchema = SchemaFactory.createForClass(CoachAction);

// Indexes
CoachActionSchema.index({ coachId: 1, status: 1 });
CoachActionSchema.index({ severity: 1, status: 1 });
CoachActionSchema.index({ childId: 1 });
CoachActionSchema.index({ createdAt: -1 });
