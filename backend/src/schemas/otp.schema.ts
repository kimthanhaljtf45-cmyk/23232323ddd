import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpDocument = HydratedDocument<Otp>;

/**
 * OTP Schema for phone verification
 * ARCHITECTURE: Phone → OTP → JWT → User → Role
 */
@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, index: true })
  phone: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop()
  usedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Auto-delete expired OTPs after 10 minutes
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });
