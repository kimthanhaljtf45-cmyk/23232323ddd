import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OfferVariantDocument = OfferVariant & Document;

export type OfferSegment = 'CHURN_RISK' | 'WARNING' | 'VIP' | 'ACTIVE' | 'NEW';

@Schema({ timestamps: true })
export class OfferVariant {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true })
  name: string; // "Retention Offer A", "Churn Save 30%"

  @Prop({ required: true, enum: ['CHURN_RISK', 'WARNING', 'VIP', 'ACTIVE', 'NEW'] })
  segment: OfferSegment;

  @Prop({ required: true })
  discountPercent: number; // 10, 20, 30, etc.

  @Prop()
  title?: string; // UI title: "Ми сумуємо за вами"

  @Prop()
  description?: string; // UI description

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  views: number; // Times shown to users

  @Prop({ default: 0 })
  conversions: number; // Times used (payment completed)

  @Prop({ default: 1 })
  priority: number; // For sorting when CR is equal

  @Prop({ default: 72 })
  ttlHours: number; // How long discount is valid

  // Computed conversion rate (for sorting)
  get conversionRate(): number {
    return this.views > 0 ? this.conversions / this.views : 0;
  }
}

export const OfferVariantSchema = SchemaFactory.createForClass(OfferVariant);

// Add virtual for conversion rate
OfferVariantSchema.virtual('conversionRate').get(function() {
  return this.views > 0 ? (this.conversions / this.views * 100).toFixed(1) : '0.0';
});
