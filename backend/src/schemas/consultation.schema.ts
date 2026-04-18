import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConsultationDocument = HydratedDocument<Consultation>;

export type ConsultationStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'BOOKED_TRIAL'
  | 'TRIAL_DONE'
  | 'CONVERTED'
  | 'LOST';

// FROZEN DOMAIN MODEL - DO NOT MODIFY
export type ProgramType =
  | 'KIDS'
  | 'SPECIAL'
  | 'SELF_DEFENSE'
  | 'MENTORSHIP'
  | 'CONSULTATION';

@Schema({ timestamps: true })
export class Consultation {
  @Prop()
  clubId: string;

  @Prop()
  userId?: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  childName?: string;

  @Prop()
  age?: number;

  @Prop({ required: true })
  phone: string;

  @Prop({ default: 'PARENT' })
  role: 'PARENT' | 'STUDENT';

  @Prop({ default: 'CONSULTATION' })
  programType: ProgramType;

  @Prop()
  district?: string;

  @Prop()
  locationId?: string;

  @Prop({ type: [String], default: [] })
  preferredDays?: string[];

  @Prop()
  experienceLevel?: string;

  @Prop()
  goal?: string;

  @Prop()
  notes?: string;

  @Prop({ default: 'NEW' })
  status: ConsultationStatus;

  @Prop()
  assignedToAdminId?: string;

  @Prop()
  assignedCoachId?: string;

  @Prop()
  assignedAt?: Date;

  @Prop()
  firstResponseAt?: Date;

  @Prop({ default: 0 })
  responseTimeMinutes?: number;

  @Prop({ default: 0 })
  score?: number;

  @Prop({ default: 'NORMAL', enum: ['HOT', 'WARM', 'COLD', 'NORMAL'] })
  priority?: string;

  @Prop({ default: false })
  isOverdue?: boolean;

  @Prop()
  trialDate?: string;

  @Prop()
  trialLocationId?: string;

  @Prop()
  contactedAt?: Date;

  @Prop()
  convertedAt?: Date;

  @Prop()
  lostReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
