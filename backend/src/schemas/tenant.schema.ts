import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

export type TenantPlan = 'START' | 'PRO' | 'AI';

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  brandName?: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: '#E30613' })
  primaryColor: string;

  @Prop({ default: '#0F0F10' })
  secondaryColor: string;

  @Prop({ type: String, enum: ['START', 'PRO', 'AI'], default: 'START' })
  plan: TenantPlan;

  @Prop({ default: true })
  isActive: boolean;

  // Limits based on plan
  @Prop({ default: 50 })
  studentsLimit: number;

  @Prop({ default: 1 })
  clubsLimit: number;

  @Prop({ default: 3 })
  coachesLimit: number;

  // Features
  @Prop({ type: [String], default: [] })
  features: string[];

  // Billing
  @Prop({ default: 0 })
  priceMonthly: number;

  @Prop()
  billingEmail?: string;

  @Prop()
  nextBillingDate?: Date;

  // Contact
  @Prop()
  ownerEmail?: string;

  @Prop()
  ownerPhone?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  // Stats (cached)
  @Prop({ default: 0 })
  totalStudents: number;

  @Prop({ default: 0 })
  totalCoaches: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop({ default: 0 })
  monthlyRevenue: number;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Indexes
// slug index already created by unique: true on @Prop
TenantSchema.index({ isActive: 1 });
TenantSchema.index({ plan: 1 });
