import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ThreadDocument = Thread & Document;

/**
 * COMMUNICATION THREAD
 * Unified thread model supporting:
 * - Coach ↔ Parent
 * - Admin ↔ Coach  
 * - Admin ↔ Parent
 * - System → Any user
 */
@Schema({ timestamps: true })
export class Thread {
  @Prop({ enum: ['DIRECT', 'SYSTEM'], default: 'DIRECT' })
  type: string;

  @Prop({ type: [String], required: true })
  participants: string[];

  @Prop()
  relatedChildId?: string;

  @Prop()
  relatedGroupId?: string;

  @Prop()
  lastMessage?: string;

  @Prop({ type: Date })
  lastMessageAt?: Date;
}

export const ThreadSchema = SchemaFactory.createForClass(Thread);

// Indexes
ThreadSchema.index({ participants: 1 });
ThreadSchema.index({ lastMessageAt: -1 });
