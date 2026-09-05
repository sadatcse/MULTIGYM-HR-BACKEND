import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Task } from './task.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type TaskAuditLogDocument = TaskAuditLog & Document;

export enum TaskEventType {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_PROGRESS_UPDATED = 'TASK_PROGRESS_UPDATED',
  TASK_ATTACHMENT_UPLOADED = 'TASK_ATTACHMENT_UPLOADED',
  TASK_SUBMITTED_FOR_APPROVAL = 'TASK_SUBMITTED_FOR_APPROVAL',
  TASK_APPROVED = 'TASK_APPROVED',
  TASK_REJECTED = 'TASK_REJECTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_CANCELLED = 'TASK_CANCELLED',
  TASK_REMINDER_SENT = 'TASK_REMINDER_SENT',
  TASK_ESCALATED = 'TASK_ESCALATED',
  TASK_DEADLINE_EXTENDED = 'TASK_DEADLINE_EXTENDED',
}

@Schema({ timestamps: true, collection: 'task_audit_logs' })
export class TaskAuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true, index: true })
  task: Task;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  actor: Employee;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  targetEmployee?: Employee;

  @Prop({ type: String, enum: Object.values(TaskEventType), required: true })
  eventType: TaskEventType;

  @Prop({ type: MongooseSchema.Types.Mixed })
  previousState?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  newState?: any;

  @Prop({ trim: true })
  comment?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const TaskAuditLogSchema = SchemaFactory.createForClass(TaskAuditLog);

TaskAuditLogSchema.index({ task: 1, timestamp: -1 });
TaskAuditLogSchema.index({ actor: 1, timestamp: -1 });
TaskAuditLogSchema.index({ eventType: 1 });
