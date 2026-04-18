import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductRecommendationDocument = ProductRecommendation & Document;

@Schema({ timestamps: true })
export class ProductRecommendation {
  @Prop({ default: '' })
  clubId: string;

  @Prop({ default: '' })
  coachId: string;

  @Prop()
  coachName?: string;

  @Prop({ required: true })
  productId: string;

  @Prop()
  productName?: string;

  @Prop()
  parentId?: string;

  @Prop()
  studentId?: string;

  @Prop()
  studentName?: string;

  @Prop()
  groupId?: string;

  @Prop()
  reason?: string;

  @Prop({ enum: ['ACTIVE', 'REMOVED', 'PURCHASED'], default: 'ACTIVE' })
  status: string;
}

export const ProductRecommendationSchema = SchemaFactory.createForClass(ProductRecommendation);

ProductRecommendationSchema.index({ clubId: 1, status: 1 });
ProductRecommendationSchema.index({ coachId: 1 });
ProductRecommendationSchema.index({ parentId: 1, status: 1 });
ProductRecommendationSchema.index({ studentId: 1, status: 1 });
ProductRecommendationSchema.index({ productId: 1 });
