import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttendanceDocument = HydratedDocument<Attendance>;

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE' | 'CANCELLED';

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  scheduleId: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  status: AttendanceStatus;

  @Prop()
  reason?: string;

  @Prop()
  comment?: string;

  @Prop()
  markedBy?: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
