import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeedPostDocument = FeedPost & Document;

export type FeedPostType = 'NEWS' | 'ANNOUNCEMENT' | 'EVENT' | 'TOURNAMENT_RESULT' | 'ACHIEVEMENT';
export type AuthorType = 'ADMIN' | 'COACH' | 'SYSTEM';

@Schema({ timestamps: true, collection: 'feed_posts' })
export class FeedPost {
  @Prop({ required: true })
  type: FeedPostType;

  @Prop({ required: true })
  title: string;

  @Prop()
  content?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  authorType: AuthorType;

  @Prop({ default: false })
  isPublished: boolean;

  @Prop()
  publishedAt?: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const FeedPostSchema = SchemaFactory.createForClass(FeedPost);
