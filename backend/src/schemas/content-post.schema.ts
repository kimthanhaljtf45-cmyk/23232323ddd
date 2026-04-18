import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContentPostDocument = HydratedDocument<ContentPost>;

@Schema({ timestamps: true })
export class ContentPost {
  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  body?: string;

  @Prop({ default: 'NEWS' })
  type: string;

  @Prop({ default: 'GLOBAL' })
  visibility: string;

  @Prop()
  groupId?: string;

  @Prop()
  mediaUrl?: string;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: Date.now })
  publishedAt: Date;
}

export const ContentPostSchema = SchemaFactory.createForClass(ContentPost);
