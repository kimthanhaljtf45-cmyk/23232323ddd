import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TournamentDocument = Tournament & Document;

export type TournamentType = 'INTERNAL' | 'OPEN' | 'CITY' | 'NATIONAL';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';

@Schema({ timestamps: true, collection: 'tournaments' })
export class Tournament {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date: string;

  @Prop()
  startTime?: string;

  @Prop()
  endTime?: string;

  @Prop({ required: true })
  locationName: string;

  @Prop()
  locationAddress?: string;

  @Prop()
  organizer?: string;

  @Prop({ required: true, default: 'INTERNAL' })
  type: TournamentType;

  @Prop({ required: true, default: 'DRAFT' })
  status: TournamentStatus;

  @Prop({ type: [String], default: [] })
  ageGroups: string[];

  @Prop({ type: [String], default: [] })
  belts: string[];

  @Prop()
  registrationOpenAt?: string;

  @Prop()
  registrationCloseAt?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ required: true })
  createdBy: string;
}

export const TournamentSchema = SchemaFactory.createForClass(Tournament);
