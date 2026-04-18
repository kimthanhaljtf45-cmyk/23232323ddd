import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubDocument = HydratedDocument<Club>;

export type ClubPlan = 'START' | 'PRO' | 'ENTERPRISE';
export type ClubStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED';

@Schema({ timestamps: true })
export class Club {
  // === IDENTITY ===
  @Prop({ required: true })
  name: string;

  @Prop()
  legalName?: string;

  @Prop({ unique: true, sparse: true })
  slug?: string;

  // === OWNER ===
  @Prop()
  ownerUserId?: string;

  // === STATUS ===
  @Prop({ type: String, enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED'], default: 'ACTIVE' })
  status: ClubStatus;

  // === BRANDING ===
  @Prop()
  logoUrl?: string;

  @Prop({ default: '#DC2626' })
  primaryColor: string;

  @Prop({ default: '#0F0F10' })
  secondaryColor: string;

  @Prop()
  coverUrl?: string;

  // === CONTACT ===
  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  website?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop({ default: 'UA' })
  country: string;

  @Prop({ default: 'Europe/Kiev' })
  timezone: string;

  @Prop({ default: 'UAH' })
  currency: string;

  // === SaaS PLAN ===
  @Prop({ type: String, enum: ['START', 'PRO', 'ENTERPRISE'], default: 'START' })
  plan: ClubPlan;

  @Prop({ type: String, enum: ['ACTIVE', 'PAST_DUE', 'TRIAL', 'CANCELED'], default: 'ACTIVE' })
  saasStatus: string;

  @Prop({ default: 0 })
  priceMonthly: number;

  @Prop()
  nextBillingDate?: Date;

  // === LIMITS ===
  @Prop({ default: 1 })
  maxBranches: number;

  @Prop({ default: 3 })
  maxCoaches: number;

  @Prop({ default: 50 })
  maxStudents: number;

  @Prop({ default: 1 })
  maxAdmins: number;

  // === FEATURES ===
  @Prop({ type: [String], default: ['dashboard', 'attendance', 'payments', 'messages'] })
  features: string[];

  // === SETTINGS ===
  @Prop({ default: false })
  allowMarketplace: boolean;

  @Prop({ default: false })
  allowCompetitions: boolean;

  @Prop({ default: true })
  allowPublicCatalog: boolean;

  @Prop({ default: true })
  allowFamilyDiscounts: boolean;

  @Prop({ default: true })
  attendanceTrackingEnabled: boolean;

  // === CACHED STATS ===
  @Prop({ default: 0 })
  studentCount: number;

  @Prop({ default: 0 })
  coachCount: number;

  @Prop({ default: 0 })
  branchCount: number;

  @Prop({ default: 0 })
  groupCount: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop({ default: 0 })
  monthlyRevenue: number;

  @Prop({ default: 0 })
  totalDebt: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ClubSchema = SchemaFactory.createForClass(Club);

ClubSchema.index({ slug: 1 });
ClubSchema.index({ ownerUserId: 1 });
ClubSchema.index({ status: 1 });
ClubSchema.index({ plan: 1 });
