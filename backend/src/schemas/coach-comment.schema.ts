import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoachCommentDocument = CoachComment & Document;

@Schema({ timestamps: true, collection: 'coach_comments' })
export class CoachComment {
  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  text: string;

  @Prop()
  type?: string;

  @Prop()
  scheduleId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CoachCommentSchema = SchemaFactory.createForClass(CoachComment);
