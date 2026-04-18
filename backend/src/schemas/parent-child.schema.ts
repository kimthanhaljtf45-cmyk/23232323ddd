import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ParentChildDocument = HydratedDocument<ParentChild>;

@Schema({ timestamps: true, collection: 'parentchildren' })
export class ParentChild {
  @Prop({ required: true })
  parentId: string;

  @Prop({ required: true })
  childId: string;

  @Prop()
  relation?: string;
}

export const ParentChildSchema = SchemaFactory.createForClass(ParentChild);
