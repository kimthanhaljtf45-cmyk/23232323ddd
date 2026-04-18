import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProgressDocument = HydratedDocument<Progress>;

@Schema({ timestamps: true })
export class Progress {
  @Prop({ required: true })
  childId: string;

  @Prop({ default: 'WHITE' })
  currentBelt: string;

  @Prop({ default: 'YELLOW' })
  nextBelt: string;

  @Prop({ default: 0 })
  progressPercent: number;

  @Prop({ default: 24 })
  trainingsToNextBelt: number;

  @Prop({ default: 0 })
  trainingsCompleted: number;
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);
