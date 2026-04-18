import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema()
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  size?: string;

  @Prop()
  color?: string;

  @Prop({ required: true })
  price: number;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop()
  clubId?: string;

  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ enum: ['NEW', 'PENDING', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED', 'CANCELED'], default: 'PENDING' })
  status: string;

  @Prop({ enum: ['NONE', 'PENDING', 'PAID', 'FAILED'], default: 'NONE' })
  paymentStatus: string;

  @Prop()
  shippingAddress?: string;

  @Prop()
  phone?: string;

  @Prop()
  comment?: string;

  @Prop({ enum: ['PICKUP', 'CLUB_PICKUP', 'DELIVERY', 'NOVA_POSHTA'], default: 'CLUB_PICKUP' })
  deliveryMethod: string;

  @Prop()
  trackingNumber?: string;

  @Prop()
  paymentId?: string;

  @Prop()
  paymentReference?: string;

  @Prop({ type: Types.ObjectId, ref: 'Child' })
  childId?: Types.ObjectId;

  @Prop()
  parentId?: string;

  @Prop()
  studentId?: string;

  @Prop()
  notes?: string;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ clubId: 1, status: 1 });
OrderSchema.index({ status: 1 });
