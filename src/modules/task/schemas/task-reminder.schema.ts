import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Task } from './task.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type TaskReminderDocument = TaskReminder & Document;

export enum TaskReminderType {
  SEVEN_DAYS_BEFORE = '7_DAYS_BEFORE',
  THREE_DAYS_BEFORE = '3_DAYS_BEFORE',
  ONE_DAY_BEFORE = '1_DAY_BEFORE',
  DUE_TODAY = 'DUE_TODAY',
  OVERDUE_DAY_1 = 'OVERDUE_DAY_1',
  ESCALATION_ADMIN = 'ESCALATION_ADMIN',
  ESCALATION_MANAGEMENT = 'ESCALATION_MANAGEMENT',
}

@Schema({ timestamps: true, collection: 'task_reminders' })
export class TaskReminder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true, index: true })
  task: Task;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Employee;

  @Prop({ type: String, enum: Object.values(TaskReminderType), required: true })
  reminderType: TaskReminderType;

  @Prop({ type: Date, default: Date.now })
  scheduledDate: Date;

  @Prop({ type: Date, default: Date.now })
  sentAt: Date;

  @Prop({ enum: ['SENT', 'SKIPPED', 'FAILED'], default: 'SENT' })
  status: string;

  @Prop({ trim: true })
  message?: string;
}

export const TaskReminderSchema = SchemaFactory.createForClass(TaskReminder);

// Enforce idempotency: Never send the exact same reminder twice for a task + employee
TaskReminderSchema.index({ task: 1, employee: 1, reminderType: 1 }, { unique: true });
TaskReminderSchema.index({ sentAt: -1 });
