import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InventoryLogDocument = InventoryLog & Document;

@Schema({ timestamps: true })
export class InventoryLog {
  @Prop({ default: '' })
  clubId: string;

  @Prop({ required: true })
  productId: string;

  @Prop()
  productName?: string;

  @Prop({ required: true, enum: ['MANUAL_ADD', 'MANUAL_REMOVE', 'ORDER_RESERVE', 'ORDER_PAID', 'ORDER_CANCEL'] })
  type: string;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  note?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdByName?: string;
}

export const InventoryLogSchema = SchemaFactory.createForClass(InventoryLog);

InventoryLogSchema.index({ clubId: 1, productId: 1 });
InventoryLogSchema.index({ createdAt: -1 });
