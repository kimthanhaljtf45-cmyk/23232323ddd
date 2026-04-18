import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TrainingSessionDocument = HydratedDocument<TrainingSession>;
export type TrainingSessionStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

@Schema({ timestamps: true })
export class TrainingSession {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  startTime: string; // HH:MM

  @Prop({ required: true })
  endTime: string; // HH:MM

  @Prop({ default: 'PLANNED' })
  status: TrainingSessionStatus;

  @Prop()
  actualStartTime?: Date;

  @Prop()
  actualEndTime?: Date;

  @Prop()
  notes?: string;

  @Prop({ default: 0 })
  presentCount: number;

  @Prop({ default: 0 })
  absentCount: number;

  @Prop({ default: 0 })
  totalStudents: number;
}

export const TrainingSessionSchema = SchemaFactory.createForClass(TrainingSession);

// Compound index: one session per group per date
TrainingSessionSchema.index({ groupId: 1, date: 1 }, { unique: true });
