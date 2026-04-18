import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  userId: string;

  @Prop()
  childId?: string; // якщо для дитини

  @Prop({ required: true })
  slotId: string;

  @Prop({
    required: true,
    enum: ['PERSONAL', 'TRIAL', 'CONSULTATION'],
  })
  type: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'DONE', 'NO_SHOW'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ required: true, default: 0 })
  price: number;

  @Prop({ default: false })
  paid: boolean;

  @Prop()
  invoiceId?: string;

  @Prop()
  note?: string;

  @Prop()
  cancelReason?: string;

  @Prop({ type: Date })
  cancelledAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
