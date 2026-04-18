import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompetitionParticipantDocument =
  HydratedDocument<CompetitionParticipant>;

@Schema({ timestamps: true })
export class CompetitionParticipant {
  @Prop({ required: true })
  competitionId: string;

  @Prop({ required: true })
  childId: string;

  @Prop({
    enum: ['PENDING', 'CONFIRMED', 'REJECTED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  @Prop({ default: false })
  paid: boolean;

  @Prop()
  category?: string; // вік / вага / пояс

  @Prop()
  invoiceId?: string;

  @Prop()
  note?: string;

  @Prop()
  parentId?: string;
}

export const CompetitionParticipantSchema = SchemaFactory.createForClass(
  CompetitionParticipant,
);
