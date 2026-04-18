import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AlertDocument = HydratedDocument<Alert>;

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  // Child Attendance
  | 'LOW_ATTENDANCE'
  | 'ABSENCE_STREAK_2'
  | 'ABSENCE_STREAK_3'
  | 'NO_VISIT_7_DAYS'
  | 'DISCIPLINE_DROP'
  // Progress
  | 'BELT_READY'
  | 'HIGH_PROGRESS'
  | 'STAGNATION'
  // Payments
  | 'PAYMENT_OVERDUE_3'
  | 'PAYMENT_OVERDUE_7'
  | 'PAYMENT_MISSED'
  // Communication
  | 'UNREAD_COACH_MESSAGE'
  | 'NO_PARENT_RESPONSE'
  // Leads
  | 'LEAD_NO_CONTACT_24H'
  | 'LEAD_STUCK_3_DAYS'
  | 'LEAD_LOST_RISK'
  // Retention
  | 'STREAK_BROKEN'
  | 'GOAL_ALMOST_DONE'
  | 'DROP_OFF_RISK'
  | 'RETURN_THIS_WEEK'
  | 'BELT_CLOSE'
  // Competitions
  | 'COMPETITION_OPEN'
  | 'COMPETITION_DEADLINE'
  | 'COMPETITION_JOINED'
  | 'COMPETITION_CONFIRMED'
  | 'COMPETITION_RESULT'
  | 'COMPETITION_PAYMENT_PENDING';

@Schema({ timestamps: true })
export class Alert {
  @Prop({ required: true })
  userId: string;

  @Prop()
  childId?: string;

  @Prop({ required: true })
  type: AlertType;

  @Prop({ required: true, default: 'warning' })
  severity: AlertSeverity;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isResolved: boolean;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  resolvedBy?: string;

  @Prop({ type: Object })
  meta?: Record<string, any>;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: false })
  notificationSent: boolean;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

// Indexes
AlertSchema.index({ userId: 1, isResolved: 1 });
AlertSchema.index({ type: 1, isResolved: 1 });
AlertSchema.index({ childId: 1 });
AlertSchema.index({ createdAt: -1 });
