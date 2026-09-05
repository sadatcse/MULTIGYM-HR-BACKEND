import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Notice } from './notice.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type NoticeAuditLogDocument = NoticeAuditLog & Document;

export enum NoticeEventType {
  NOTICE_CREATED = 'NOTICE_CREATED',
  NOTICE_UPDATED = 'NOTICE_UPDATED',
  NOTICE_PUBLISHED = 'NOTICE_PUBLISHED',
  NOTICE_DELIVERED = 'NOTICE_DELIVERED',
  NOTICE_SEEN = 'NOTICE_SEEN',
  NOTICE_ACKNOWLEDGED = 'NOTICE_ACKNOWLEDGED',
  NOTICE_REMINDER_SENT = 'NOTICE_REMINDER_SENT',
  NOTICE_EXPIRED = 'NOTICE_EXPIRED',
}

@Schema({ timestamps: true, collection: 'notice_audit_logs' })
export class NoticeAuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Notice', required: true, index: true })
  notice: Notice;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', index: true })
  employee?: Employee;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  actor: Employee;

  @Prop({ type: String, enum: Object.values(NoticeEventType), required: true })
  eventType: NoticeEventType;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const NoticeAuditLogSchema = SchemaFactory.createForClass(NoticeAuditLog);
