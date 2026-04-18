import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LocationDocument = HydratedDocument<Location>;

@Schema({ timestamps: true })
export class Location {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  city?: string;

  @Prop()
  district?: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop()
  description?: string;
}

export const LocationSchema = SchemaFactory.createForClass(Location);
