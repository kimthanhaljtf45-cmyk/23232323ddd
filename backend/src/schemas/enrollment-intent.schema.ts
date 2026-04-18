import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EnrollmentIntentDocument = HydratedDocument<EnrollmentIntent>;

export type OnboardingStatus = 'NEW' | 'REVIEW' | 'QUALIFIED' | 'ENROLLED';

@Schema({ timestamps: true })
export class EnrollmentIntent {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  role: string;

  @Prop({ required: true })
  programType: string;

  @Prop()
  childName?: string;

  @Prop()
  age?: number;

  @Prop()
  goal?: string;

  @Prop()
  district?: string;

  @Prop({ type: [String] })
  preferredSchedule?: string[];

  @Prop()
  specialNotes?: string;

  @Prop({ default: 'NEW' })
  status: OnboardingStatus;
}

export const EnrollmentIntentSchema = SchemaFactory.createForClass(EnrollmentIntent);
