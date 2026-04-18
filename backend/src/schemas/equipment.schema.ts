import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EquipmentRecommendationDocument = EquipmentRecommendation & Document;

// Equipment catalog item
@Schema({ timestamps: true })
export class Equipment {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['KIMONO', 'GLOVES', 'PROTECTION', 'SHOES', 'BAG', 'OTHER'] })
  category: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  imageUrl: string;

  @Prop({ type: [String] })
  sportTypes: string[]; // KARATE, TAEKWONDO, BOXING, MMA

  @Prop({ type: [String] })
  levels: string[]; // BEGINNER, INTERMEDIATE, ADVANCED

  @Prop()
  minAge: number;

  @Prop()
  maxAge: number;

  @Prop()
  minHeight: number;

  @Prop()
  maxHeight: number;

  @Prop()
  minWeight: number;

  @Prop()
  maxWeight: number;

  @Prop({ type: [String] })
  sizes: string[]; // XS, S, M, L, XL, XXL or specific

  @Prop()
  brand: string;

  @Prop()
  affiliateUrl: string;

  @Prop({ default: 0 })
  commissionPercent: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  priority: number; // for sorting recommendations
}

export const EquipmentSchema = SchemaFactory.createForClass(Equipment);

// Recommendation for a specific child
@Schema({ timestamps: true })
export class EquipmentRecommendation {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  parentId: string;

  @Prop()
  tenantId: string;

  @Prop({ required: true })
  equipmentId: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  reason: string; // "Для вашего роста 140см рекомендуем размер M"

  @Prop()
  recommendedSize: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  imageUrl: string;

  @Prop()
  affiliateUrl: string;

  @Prop({ default: 0 })
  priority: number;

  @Prop({ default: false })
  viewed: boolean;

  @Prop({ default: false })
  clicked: boolean;

  @Prop({ default: false })
  purchased: boolean;

  @Prop({ type: Date })
  viewedAt: Date;

  @Prop({ type: Date })
  clickedAt: Date;

  @Prop({ type: Date })
  purchasedAt: Date;
}

export const EquipmentRecommendationSchema = SchemaFactory.createForClass(EquipmentRecommendation);
EquipmentRecommendationSchema.index({ childId: 1 });
EquipmentRecommendationSchema.index({ parentId: 1 });
