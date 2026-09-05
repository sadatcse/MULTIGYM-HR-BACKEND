import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';
import { Notice } from '../../notice/schemas/notice.schema';

export type TaskDocument = Task & Document;

export enum InstructionSource {
  MD_SIR = 'MD Sir',
  DIRECTOR_SIR = 'Director Sir',
  MANAGEMENT = 'Management',
  ADMIN_HR = 'Admin & HR',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  COMPLETED = 'COMPLETED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum CompletionCondition {
  ALL_ASSIGNEES = 'ALL_ASSIGNEES',
  ANY_ASSIGNEE = 'ANY_ASSIGNEE',
}

@Schema({ _id: false })
export class TaskAttachment {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  fileType?: string;

  @Prop()
  size?: number;

  @Prop({ default: Date.now })
  uploadedAt?: Date;

  @Prop({ trim: true })
  remark?: string;
}
export const TaskAttachmentSchema = SchemaFactory.createForClass(TaskAttachment);

@Schema({ timestamps: true })
export class TaskItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: [true, 'Subtask title is required'], trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Employee' }], default: [] })
  assignees: Employee[];

  @Prop({
    type: String,
    enum: Object.values(TaskPriority),
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Prop({ type: Date })
  deadline?: Date;

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: Boolean, default: false })
  approvalRequired: boolean;

  @Prop({ type: Boolean, default: false })
  completionProofRequired: boolean;

  @Prop({ type: [TaskAttachmentSchema], default: [] })
  proofs: TaskAttachment[];

  @Prop({ type: Number, min: 0, max: 100 })
  rating?: number;

  @Prop({ trim: true })
  approvalComment?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  approvedBy?: Employee;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}
export const TaskItemSchema = SchemaFactory.createForClass(TaskItem);

@Schema({ _id: false })
export class DeadlineChangeRecord {
  @Prop({ required: true })
  oldDeadline: Date;

  @Prop({ required: true })
  newDeadline: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  changedBy: Employee;

  @Prop({ default: Date.now })
  changedAt: Date;

  @Prop({ required: true })
  reason: string;
}
export const DeadlineChangeRecordSchema = SchemaFactory.createForClass(DeadlineChangeRecord);

@Schema({ _id: false })
export class RecurrenceConfig {
  @Prop({ enum: ['daily', 'weekly', 'monthly', 'custom'], default: 'daily' })
  frequency: string;

  @Prop({ default: 1 })
  intervalDays: number;

  @Prop()
  endDate?: Date;
}
export const RecurrenceConfigSchema = SchemaFactory.createForClass(RecurrenceConfig);

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ required: [true, 'Task title is required'], trim: true })
  title: string;

  @Prop({ required: [true, 'Task description / instruction is required'], trim: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(InstructionSource),
    required: [true, 'Instruction source is required'],
    default: InstructionSource.MANAGEMENT,
  })
  instructionSource: InstructionSource;

  @Prop({ trim: true })
  instructionSourceCustom?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  issuedBy: Employee;

  @Prop({ trim: true, default: 'All Branches' })
  branch: string;

  @Prop({ trim: true, default: 'All Departments' })
  department: string;

  @Prop({ trim: true, default: 'Management Instruction' })
  category: string;

  @Prop({
    type: String,
    enum: Object.values(TaskPriority),
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Prop({ type: Date, default: Date.now })
  instructionDate: Date;

  @Prop({ type: Date, default: Date.now })
  startDate: Date;

  @Prop({ type: Date, required: [true, 'Task deadline is required'] })
  deadline: Date;

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: Boolean, default: false })
  approvalRequired: boolean;

  @Prop({ type: Boolean, default: false })
  completionProofRequired: boolean;

  @Prop({
    type: String,
    enum: Object.values(CompletionCondition),
    default: CompletionCondition.ALL_ASSIGNEES,
  })
  completionCondition: CompletionCondition;

  @Prop({ type: [TaskAttachmentSchema], default: [] })
  attachments: TaskAttachment[];

  @Prop({ type: [TaskItemSchema], default: [] })
  items: TaskItem[];

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Notice' })
  relatedNotice?: Notice;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  relatedEmployee?: Employee;

  @Prop({ trim: true })
  relatedProject?: string;

  @Prop({ trim: true })
  estimatedEffort?: string;

  @Prop({ type: Boolean, default: false })
  isRecurring: boolean;

  @Prop({ type: RecurrenceConfigSchema })
  recurrence?: RecurrenceConfig;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task' })
  parentTaskId?: Task;

  @Prop({ type: [Number], default: [7, 3, 1, 0, -1] })
  reminderSchedule: number[];

  @Prop({ type: [DeadlineChangeRecordSchema], default: [] })
  deadlineHistory: DeadlineChangeRecord[];

  @Prop({ trim: true })
  cancellationReason?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  cancelledBy?: Employee;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  createdBy: Employee;

  @Prop({ type: Boolean, default: false })
  isOverdue: boolean;

  @Prop({ type: Boolean, default: false })
  wasOverdue: boolean;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ status: 1 });
TaskSchema.index({ instructionSource: 1 });
TaskSchema.index({ branch: 1 });
TaskSchema.index({ department: 1 });
TaskSchema.index({ category: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ deadline: 1 });
TaskSchema.index({ createdAt: -1 });
TaskSchema.index({ isOverdue: 1 });
