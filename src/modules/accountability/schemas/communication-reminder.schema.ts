import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';
import { CommunicationType } from './communication-event.schema';

export type CommunicationReminderDocument = CommunicationReminder & Document;

export enum CommonReminderType {
  BEFORE_7D = 'BEFORE_7D',
  BEFORE_3D = 'BEFORE_3D',
  BEFORE_1D = 'BEFORE_1D',
  DUE_TODAY = 'DUE_TODAY',
  OVERDUE_DAY_1 = 'OVERDUE_DAY_1',
  OVERDUE_ESCALATION_ADMIN = 'OVERDUE_ESCALATION_ADMIN',
  OVERDUE_ESCALATION_MANAGEMENT = 'OVERDUE_ESCALATION_MANAGEMENT',
  ACKNOWLEDGEMENT_REQUIRED = 'ACKNOWLEDGEMENT_REQUIRED',
  APPROVAL_PENDING = 'APPROVAL_PENDING',
}

@Schema({ timestamps: true, collection: 'communication_reminders' })
export class CommunicationReminder {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  communicationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CommunicationType),
    required: true,
    index: true,
  })
  communicationType: CommunicationType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Employee.name, required: true, index: true })
  targetEmployee: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CommonReminderType),
    required: true,
    index: true,
  })
  reminderType: CommonReminderType;

  @Prop({ type: String, default: 'IN_APP' })
  channel: string;

  @Prop({ type: String, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  message: string;

  @Prop({ type: Date, default: Date.now, index: true })
  sentAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;
}

export const CommunicationReminderSchema = SchemaFactory.createForClass(CommunicationReminder);

// Compound Unique Index: prevents duplicate reminder dispatches of the same type to the same recipient
CommunicationReminderSchema.index(
  { communicationId: 1, targetEmployee: 1, reminderType: 1 },
  { unique: true },
);
