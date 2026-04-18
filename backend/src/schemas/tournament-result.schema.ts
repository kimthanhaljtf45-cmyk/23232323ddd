import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TournamentResultDocument = TournamentResult & Document;

export type MedalType = 'GOLD' | 'SILVER' | 'BRONZE';

@Schema({ timestamps: true, collection: 'tournament_results' })
export class TournamentResult {
  @Prop({ required: true })
  tournamentId: string;

  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  place: number;

  @Prop()
  medal?: MedalType;

  @Prop({ required: true, default: 0 })
  points: number;

  @Prop()
  notes?: string;

  @Prop({ required: true })
  enteredBy: string;
}

export const TournamentResultSchema = SchemaFactory.createForClass(TournamentResult);
