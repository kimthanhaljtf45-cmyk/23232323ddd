import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommunicationMessageDocument = CommunicationMessage & Document;

/**
 * COMMUNICATION MESSAGE
 * Supports TEXT and SYSTEM messages with action metadata
 */
@Schema({ timestamps: true })
export class CommunicationMessage {
  @Prop({ required: true })
  threadId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop()
  text: string;

  @Prop({ enum: ['TEXT', 'SYSTEM'], default: 'TEXT' })
  type: string;

  @Prop({ type: Object })
  meta?: {
    action?: string; // PAYMENT_REMINDER | ABSENCE | RETENTION | COACH_ACTION | COMPETITION_INVITE
    childId?: string;
    invoiceId?: string;
    groupId?: string;
    subscriptionId?: string;
  };

  @Prop({ type: [String], default: [] })
  readBy: string[];
}

export const CommunicationMessageSchema = SchemaFactory.createForClass(CommunicationMessage);

// Indexes
CommunicationMessageSchema.index({ threadId: 1, createdAt: 1 });
CommunicationMessageSchema.index({ threadId: 1, readBy: 1 });
