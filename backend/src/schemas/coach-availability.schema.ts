import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CoachAvailabilityDocument = HydratedDocument<CoachAvailability>;

@Schema({ timestamps: true })
export class CoachAvailability {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true, min: 1, max: 7 })
  dayOfWeek: number; // 1 = Monday, 7 = Sunday

  @Prop({ required: true })
  startTime: string; // "09:00"

  @Prop({ required: true })
  endTime: string; // "18:00"

  @Prop({ default: true })
  isActive: boolean;
}

export const CoachAvailabilitySchema = SchemaFactory.createForClass(CoachAvailability);
