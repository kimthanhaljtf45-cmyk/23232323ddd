import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  shortDescription?: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  oldPrice?: number;

  @Prop()
  costPrice?: number;

  @Prop({ required: true, enum: ['EQUIPMENT', 'SUPPLEMENT', 'CLOTHING', 'ACCESSORY', 'ACCESSORIES', 'UNIFORM', 'PROTECTION', 'NUTRITION', 'SPORT_NUTRITION'] })
  category: string;

  @Prop({ type: [String], default: [] })
  subcategories: string[];

  @Prop()
  brand?: string;

  @Prop()
  sku?: string;

  @Prop({ enum: ['DRAFT', 'ACTIVE', 'HIDDEN', 'ARCHIVED'], default: 'ACTIVE' })
  status: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  coverImage?: string;

  @Prop({ default: 0 })
  stock: number;

  @Prop({ default: 0 })
  reservedStock: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isRecommended: boolean;

  @Prop({ default: 0 })
  salesCount: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  reviewsCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  sizes: string[];

  @Prop({ type: [String], default: [] })
  colors: string[];

  @Prop({ type: Object })
  sizeChart?: {
    ageMin?: number;
    ageMax?: number;
    heightMin?: number;
    heightMax?: number;
  };

  @Prop({ type: Object })
  nutritionMeta?: {
    type?: string;
    ageRestricted?: boolean;
    minAge?: number;
    warning?: string;
  };

  // Club-scoped
  @Prop()
  clubId?: string;

  // Coach recommendation
  @Prop()
  recommendedByCoachId?: string;

  @Prop()
  recommendedByCoachName?: string;

  // Legacy compatibility
  @Prop({ enum: ['KARATE', 'TAEKWONDO', 'BOXING', 'MMA', 'JUDO', 'WRESTLING', 'UNIVERSAL'], default: 'UNIVERSAL' })
  sportType: string;

  @Prop({ enum: ['TRAINING', 'COMPETITION', 'BOTH'], default: 'BOTH' })
  usageType: string;

  @Prop({ default: false })
  isNewArrival: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Tenant' })
  tenantId?: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1, isActive: 1, status: 1 });
ProductSchema.index({ clubId: 1, status: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ recommendedByCoachId: 1 });
