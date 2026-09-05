import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';

export type CommunicationEventDocument = CommunicationEvent & Document;

export enum CommunicationType {
  NOTICE = 'NOTICE',
  TASK = 'TASK',
  INSTRUCTION = 'INSTRUCTION',
  APPROVAL_REQUEST = 'APPROVAL_REQUEST',
  POLICY = 'POLICY',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export enum AccountabilityEventType {
  COMMUNICATION_CREATED = 'COMMUNICATION_CREATED',
  COMMUNICATION_UPDATED = 'COMMUNICATION_UPDATED',
  COMMUNICATION_PUBLISHED = 'COMMUNICATION_PUBLISHED',
  COMMUNICATION_ASSIGNED = 'COMMUNICATION_ASSIGNED',
  COMMUNICATION_DELIVERED = 'COMMUNICATION_DELIVERED',
  COMMUNICATION_SEEN = 'COMMUNICATION_SEEN',
  COMMUNICATION_ACKNOWLEDGED = 'COMMUNICATION_ACKNOWLEDGED',
  COMMUNICATION_STARTED = 'COMMUNICATION_STARTED',
  COMMUNICATION_PROGRESS_UPDATED = 'COMMUNICATION_PROGRESS_UPDATED',
  COMMUNICATION_ATTACHMENT_UPLOADED = 'COMMUNICATION_ATTACHMENT_UPLOADED',
  COMMUNICATION_SUBMITTED = 'COMMUNICATION_SUBMITTED',
  COMMUNICATION_APPROVED = 'COMMUNICATION_APPROVED',
  COMMUNICATION_REJECTED = 'COMMUNICATION_REJECTED',
  COMMUNICATION_COMPLETED = 'COMMUNICATION_COMPLETED',
  COMMUNICATION_OVERDUE = 'COMMUNICATION_OVERDUE',
  COMMUNICATION_DEADLINE_EXTENDED = 'COMMUNICATION_DEADLINE_EXTENDED',
  COMMUNICATION_REMINDER_SENT = 'COMMUNICATION_REMINDER_SENT',
  COMMUNICATION_ESCALATED = 'COMMUNICATION_ESCALATED',
  COMMUNICATION_CANCELLED = 'COMMUNICATION_CANCELLED',
}

@Schema({ timestamps: true, collection: 'communication_events' })
export class CommunicationEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  communicationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CommunicationType),
    required: true,
    index: true,
  })
  communicationType: CommunicationType;

  @Prop({ required: true, trim: true, index: true })
  title: string;

  @Prop({ type: String, default: 'Management', index: true })
  source: string;

  @Prop({
    type: String,
    enum: Object.values(AccountabilityEventType),
    required: true,
    index: true,
  })
  eventType: AccountabilityEventType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Employee.name, required: true, index: true })
  actor: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Employee.name, index: true })
  targetUser?: Types.ObjectId;

  @Prop({ type: String, trim: true, default: 'All Branches', index: true })
  branch?: string;

  @Prop({ type: String, trim: true, default: 'All Departments', index: true })
  department?: string;

  @Prop({ type: String, trim: true })
  previousStatus?: string;

  @Prop({ type: String, trim: true })
  newStatus?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  @Prop({ type: String, trim: true })
  comment?: string;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;
}

export const CommunicationEventSchema = SchemaFactory.createForClass(CommunicationEvent);

CommunicationEventSchema.index({ communicationId: 1, timestamp: -1 });
CommunicationEventSchema.index({ communicationType: 1, timestamp: -1 });
CommunicationEventSchema.index({ actor: 1, timestamp: -1 });
CommunicationEventSchema.index({ targetUser: 1, timestamp: -1 });
