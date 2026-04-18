import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReferralDocument = Referral & Document;

export type ReferralStatus = 'PENDING' | 'REGISTERED' | 'CONFIRMED' | 'REWARDED';

@Schema({ timestamps: true })
export class Referral {
  @Prop({ default: 'default' })
  tenantId: string;

  @Prop({ required: true })
  inviterUserId: string;

  @Prop()
  invitedUserId?: string; // Set when user registers

  @Prop()
  invitedPhone?: string; // Invited person's phone

  @Prop({ required: true })
  referralCode: string;

  @Prop({ type: String, enum: ['PENDING', 'REGISTERED', 'CONFIRMED', 'REWARDED'], default: 'PENDING' })
  status: ReferralStatus;

  @Prop({ default: false })
  inviterRewardGiven: boolean;

  @Prop({ default: false })
  invitedRewardGiven: boolean;

  @Prop()
  inviterRewardType?: string; // 'FREE_MONTH' or 'PERCENT_50'

  @Prop()
  invitedRewardType?: string; // 'PERCENT_10' etc.

  @Prop({ type: Date })
  registeredAt?: Date;

  @Prop({ type: Date })
  confirmedAt?: Date; // When invited user makes first payment

  @Prop({ type: Date })
  rewardedAt?: Date;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
