import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProgramType } from '../domain/enums';

export type ProgramDocument = HydratedDocument<Program>;

@Schema({ timestamps: true })
export class Program {
  @Prop({ required: true })
  name: string; // "Дитяча група"

  @Prop({
    required: true,
    enum: ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'],
  })
  type: ProgramType;

  @Prop()
  description?: string;

  @Prop({ required: true })
  price: number; // грн / місяць

  @Prop({ required: true, default: 3 })
  trainingsPerWeek: number;

  @Prop({ required: true, default: 60 })
  duration: number; // хвилини

  @Prop({ required: true, default: 15 })
  maxStudents: number;

  @Prop({ type: [String], default: [] })
  coachIds: string[];

  @Prop({ required: true })
  clubId: string;

  @Prop({ enum: ['beginner', 'intermediate', 'advanced'] })
  level?: string;

  @Prop()
  ageFrom?: number;

  @Prop()
  ageTo?: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProgramSchema = SchemaFactory.createForClass(Program);
