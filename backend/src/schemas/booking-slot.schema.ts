import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingSlotDocument = HydratedDocument<BookingSlot>;

@Schema({ timestamps: true })
export class BookingSlot {
  @Prop({ required: true })
  clubId: string;

  @Prop({ required: true })
  coachId: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  startTime: string; // "14:00"

  @Prop({ required: true })
  endTime: string; // "15:00"

  @Prop({ default: 60 })
  duration: number; // хвилини

  @Prop({
    required: true,
    enum: ['AVAILABLE', 'BOOKED', 'BLOCKED'],
    default: 'AVAILABLE',
  })
  status: string;

  @Prop({
    required: true,
    enum: ['PERSONAL', 'TRIAL', 'CONSULTATION'],
    default: 'PERSONAL',
  })
  type: string;

  @Prop()
  bookingId?: string; // якщо заброньовано
}

export const BookingSlotSchema = SchemaFactory.createForClass(BookingSlot);
