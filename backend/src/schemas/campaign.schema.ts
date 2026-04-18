import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CampaignDocument = Campaign & Document;

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ default: '' })
  clubId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['DISCOUNT', 'FEATURED', 'BUNDLE'], default: 'DISCOUNT' })
  type: string;

  @Prop({ enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED'], default: 'DRAFT' })
  status: string;

  @Prop({ type: [String], default: [] })
  productIds: string[];

  @Prop()
  category?: string;

  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ default: 0 })
  fixedDiscount: number;

  @Prop()
  startsAt?: Date;

  @Prop()
  endsAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ clubId: 1, status: 1 });
CampaignSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });
