import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CoachProfileDocument = HydratedDocument<CoachProfile>;

@Schema({ timestamps: true })
export class CoachProfile {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ type: [String], default: [] })
  clubIds: string[];

  @Prop({ type: [String], default: [] })
  groupIds: string[];

  @Prop({ type: [String], default: [] })
  specialization: string[];

  @Prop()
  bio?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CoachProfileSchema = SchemaFactory.createForClass(CoachProfile);
