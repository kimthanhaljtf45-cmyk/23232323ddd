import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TournamentParticipantDocument = TournamentParticipant & Document;

export type ParticipantStatus = 'REGISTERED' | 'APPROVED' | 'REJECTED' | 'CHECKED_IN' | 'ABSENT' | 'COMPETED';
export type RegisteredByRole = 'PARENT' | 'COACH' | 'ADMIN';

@Schema({ timestamps: true, collection: 'tournament_participants' })
export class TournamentParticipant {
  @Prop({ required: true })
  tournamentId: string;

  @Prop({ required: true })
  childId: string;

  @Prop({ required: true })
  parentId: string;

  @Prop()
  coachId?: string;

  @Prop()
  groupId?: string;

  @Prop({ required: true, default: 'REGISTERED' })
  status: ParticipantStatus;

  @Prop({ required: true })
  registeredByRole: RegisteredByRole;

  @Prop({ required: true })
  registeredByUserId: string;

  @Prop()
  note?: string;
}

export const TournamentParticipantSchema = SchemaFactory.createForClass(TournamentParticipant);
