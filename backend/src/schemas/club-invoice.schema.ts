import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubInvoiceDocument = HydratedDocument<ClubInvoice>;

@Schema({ timestamps: true })
export class ClubInvoice {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  subscriptionId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'UAH' })
  currency: string;

  @Prop({ required: true, enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELED'], default: 'PENDING' })
  status: string;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  paidAt: Date;

  @Prop()
  plan: string;

  @Prop()
  period: string; // e.g. "2026-04"

  @Prop()
  description: string;
}

export const ClubInvoiceSchema = SchemaFactory.createForClass(ClubInvoice);
ClubInvoiceSchema.index({ clubId: 1, status: 1 });
ClubInvoiceSchema.index({ subscriptionId: 1 });
