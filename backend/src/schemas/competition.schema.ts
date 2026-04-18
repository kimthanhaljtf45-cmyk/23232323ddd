import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProgramType } from '../domain/enums';

export type CompetitionDocument = HydratedDocument<Competition>;

@Schema({ timestamps: true })
export class Competition {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  location: string;

  @Prop({
    required: true,
    enum: ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'],
  })
  programType: ProgramType;

  @Prop({ required: true })
  registrationDeadline: string; // YYYY-MM-DD

  @Prop({ default: false })
  hasFee: boolean;

  @Prop()
  feeAmount?: number;

  @Prop({
    enum: ['DRAFT', 'OPEN', 'CLOSED', 'FINISHED'],
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED';

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  clubId?: string;

  @Prop()
  imageUrl?: string;
}

export const CompetitionSchema = SchemaFactory.createForClass(Competition);
