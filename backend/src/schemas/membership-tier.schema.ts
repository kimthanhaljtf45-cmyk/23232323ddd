import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MembershipTierDocument = HydratedDocument<MembershipTier>;

@Schema({ timestamps: true })
export class MembershipTier {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true, enum: ['BASE', 'PRO', 'VIP'] })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true, default: 3 })
  trainingsPerWeek: number;

  @Prop({ default: false })
  includesPersonal: boolean;

  @Prop({ default: 0 })
  freePersonalSessions: number; // для VIP

  @Prop({ default: false })
  includesCompetitions: boolean;

  @Prop({ default: false })
  prioritySupport: boolean;

  @Prop({ default: 0 })
  personalDiscount: number; // % знижка на персоналки

  @Prop({ default: 1 })
  discountMultiplier: number; // множник для інших знижок

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  benefits: string[]; // ["Доступ до змагань", "Персональні тренування"]
}

export const MembershipTierSchema = SchemaFactory.createForClass(MembershipTier);
