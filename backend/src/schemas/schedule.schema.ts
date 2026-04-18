import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScheduleDocument = HydratedDocument<Schedule>;

@Schema({ timestamps: true })
export class Schedule {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  dayOfWeek: number; // 1=Mon, 7=Sun

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
