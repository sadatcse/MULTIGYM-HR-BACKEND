import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Notice } from './notice.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type NoticeRecipientDocument = NoticeRecipient & Document;

export enum RecipientStatus {
  DELIVERED = 'delivered',
  SEEN = 'seen',
  ACKNOWLEDGED = 'acknowledged',
  ACKNOWLEDGED_LATE = 'acknowledged_late',
}

@Schema({ timestamps: true, collection: 'notice_recipients' })
export class NoticeRecipient {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Notice', required: true, index: true })
  notice: Notice;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Employee;

  @Prop({
    type: String,
    enum: Object.values(RecipientStatus),
    default: RecipientStatus.DELIVERED,
    index: true,
  })
  status: RecipientStatus;

  @Prop({ type: Date, default: Date.now })
  deliveredAt: Date;

  @Prop({ type: Date })
  firstSeenAt?: Date;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Date })
  acknowledgedAt?: Date;

  @Prop({ type: Number })
  acknowledgedVersion?: number;

  @Prop({ type: Date })
  lastReminderSentAt?: Date;
}

export const NoticeRecipientSchema = SchemaFactory.createForClass(NoticeRecipient);

// Compound Index to prevent duplicate recipient entries
NoticeRecipientSchema.index({ notice: 1, employee: 1 }, { unique: true });
