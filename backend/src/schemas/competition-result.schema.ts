import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompetitionResultDocument = HydratedDocument<CompetitionResult>;

@Schema({ timestamps: true })
export class CompetitionResult {
  @Prop({ required: true })
  competitionId: string;

  @Prop({ required: true })
  childId: string;

  @Prop({
    enum: ['GOLD', 'SILVER', 'BRONZE', 'PARTICIPATION'],
    required: true,
  })
  medal: 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTICIPATION';

  @Prop({ required: true })
  place: number;

  @Prop()
  awardType?: string; // MVP / Краща техніка / Дух бійця

  @Prop()
  note?: string;
}

export const CompetitionResultSchema =
  SchemaFactory.createForClass(CompetitionResult);
