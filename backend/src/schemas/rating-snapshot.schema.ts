import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RatingSnapshotDocument = HydratedDocument<RatingSnapshot>;

@Schema({ timestamps: true })
export class RatingSnapshot {
  @Prop({ required: true })
  childId: string;

  @Prop()
  groupId?: string;

  @Prop({ required: true })
  score: number;

  @Prop()
  attendanceScore: number;

  @Prop()
  progressScore: number;

  @Prop()
  tournamentScore: number;

  @Prop()
  rankInGroup?: number;

  @Prop()
  rankInClub?: number;

  @Prop()
  belt: string;

  @Prop({ default: Date.now })
  calculatedAt: Date;
}

export const RatingSnapshotSchema = SchemaFactory.createForClass(RatingSnapshot);
