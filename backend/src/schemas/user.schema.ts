import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// FROZEN DOMAIN MODEL - DO NOT MODIFY
export type UserRole = 'PARENT' | 'STUDENT' | 'COACH' | 'OWNER' | 'ADMIN';
export type ProgramType = 'KIDS' | 'SPECIAL' | 'SELF_DEFENSE' | 'MENTORSHIP' | 'CONSULTATION';

@Schema({ timestamps: true })
export class User {
  @Prop()
  firstName: string;

  @Prop()
  lastName?: string;

  @Prop()
  username?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop({ unique: true, sparse: true })
  telegramId?: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop({ type: String, default: 'PARENT' })
  role: UserRole;

  @Prop({ type: String, default: 'ACTIVE' })
  status: string;

  @Prop({ type: String })
  avatarUrl?: string;

  @Prop({ type: String })
  description?: string;

  // Program-aware fields
  @Prop({ type: String, default: 'KIDS' })
  programType: ProgramType;

  @Prop({ default: false })
  isOnboarded: boolean;

  @Prop()
  activeClubId?: string;

  @Prop()
  onboardingStage?: string;

  // Referral system
  @Prop({ unique: true, sparse: true })
  referralCode?: string;

  @Prop()
  referredBy?: string; // userId who referred this user

  // Coach settings
  @Prop({ type: Object })
  notificationSettings?: {
    pushEnabled: boolean;
    trainingReminders: boolean;
    studentAlerts: boolean;
    weeklyReport: boolean;
  };

  @Prop({ type: Array })
  workSchedule?: Array<{
    day: string;
    enabled: boolean;
    startTime: string;
    endTime: string;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);
