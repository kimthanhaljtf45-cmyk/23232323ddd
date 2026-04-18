import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageThreadDocument = HydratedDocument<MessageThread>;

@Schema({ timestamps: true })
export class MessageThread {
  @Prop({ required: true })
  parentId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop()
  childId?: string;

  @Prop()
  lastMessage?: string;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: 0 })
  unreadParent: number;

  @Prop({ default: 0 })
  unreadCoach: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageThreadSchema = SchemaFactory.createForClass(MessageThread);
