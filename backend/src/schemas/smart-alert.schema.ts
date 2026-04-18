import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SmartAlertDocument = HydratedDocument<SmartAlert>;

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertScope = 'child' | 'group' | 'club' | 'payment' | 'message';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

@Schema({ timestamps: true })
export class SmartAlert {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true, default: 'warning' })
  severity: AlertSeverity;

  @Prop({ required: true, default: 'club' })
  scope: AlertScope;

  @Prop()
  entityId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  assignedToRole: string;

  @Prop()
  assignedToUserId?: string;

  @Prop({ default: 'open' })
  status: AlertStatus;

  @Prop({ type: Object })
  meta?: Record<string, any>;

  @Prop()
  resolvedAt?: Date;
}

export const SmartAlertSchema = SchemaFactory.createForClass(SmartAlert);
