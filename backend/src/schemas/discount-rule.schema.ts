import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DiscountRuleDocument = DiscountRule & Document;

// DISCOUNT TYPES
export type DiscountType = 'REFERRAL' | 'PROMO' | 'MANUAL' | 'SUBSCRIPTION' | 'FIRST_TIME' | 'FAMILY' | 'LOYALTY' | 'PERFORMANCE' | 'VOLUME' | 'METABRAIN';
export type DiscountValueType = 'PERCENT' | 'FIXED' | 'FREE_PERIOD';
export type DiscountContextType = 'BOOKING' | 'SUBSCRIPTION' | 'ALL';
export type DiscountSource = 'METABRAIN' | 'REFERRAL' | 'PROMO' | 'MANUAL' | 'SYSTEM';

@Schema({ timestamps: true })
export class DiscountRule {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ['REFERRAL', 'PROMO', 'MANUAL', 'SUBSCRIPTION', 'FIRST_TIME', 'FAMILY', 'LOYALTY', 'PERFORMANCE', 'VOLUME', 'METABRAIN'], required: true })
  type: DiscountType;

  @Prop({ type: String, enum: ['PERCENT', 'FIXED', 'FREE_PERIOD'], required: true })
  valueType: DiscountValueType;

  @Prop({ required: true })
  value: number; // 10 for 10% or 500 for 500 UAH

  @Prop({ default: 10 })
  priority: number; // Lower = higher priority (1 is highest)

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isStackable: boolean; // Can be combined with other discounts

  @Prop({ type: String, enum: ['BOOKING', 'SUBSCRIPTION', 'ALL'], default: 'ALL' })
  contextType: DiscountContextType;

  @Prop()
  promoCode?: string; // For PROMO type

  @Prop()
  description?: string;

  @Prop()
  minPurchaseAmount?: number;

  @Prop()
  maxDiscountAmount?: number; // Cap for percent discounts

  @Prop()
  usageLimit?: number; // Total uses allowed

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  perUserLimit?: number; // Uses per user

  @Prop({ type: Date })
  startsAt?: Date;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop()
  group?: string; // For mutual exclusion: 'ACQUISITION', 'RETENTION', 'STRUCTURE'

  @Prop({ type: Object })
  conditions?: {
    minChildren?: number; // For FAMILY discount
    minMonthsActive?: number; // For LOYALTY discount
    medalTypes?: string[]; // For PERFORMANCE discount
    programTypes?: string[]; // Apply only to specific programs
  };

  // ============= METABRAIN / PERSONALIZATION FIELDS =============
  
  @Prop()
  userId?: string; // For user-specific discounts (MetaBrain)

  @Prop({ type: String, enum: ['METABRAIN', 'REFERRAL', 'PROMO', 'MANUAL', 'SYSTEM'] })
  source?: DiscountSource; // Where the discount came from

  @Prop()
  reason?: string; // Why discount was created (for UI display)

  @Prop()
  offerId?: string; // Link to OfferVariant for Growth Engine tracking
}

export const DiscountRuleSchema = SchemaFactory.createForClass(DiscountRule);
