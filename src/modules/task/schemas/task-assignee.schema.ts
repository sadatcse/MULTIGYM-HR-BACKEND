import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Task, TaskStatus } from './task.schema';
import { Employee } from '../../user/schemas/employee.schema';

export type TaskAssigneeDocument = TaskAssignee & Document;

@Schema({ _id: false })
export class TaskProof {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  fileType?: string;

  @Prop()
  size?: number;

  @Prop({ default: Date.now })
  uploadedAt: Date;

  @Prop({ default: 1 })
  version: number;

  @Prop({ trim: true })
  remark?: string;
}
export const TaskProofSchema = SchemaFactory.createForClass(TaskProof);

@Schema({ _id: false })
export class TaskSubmissionRecord {
  @Prop({ required: true })
  cycle: number;

  @Prop({ default: Date.now })
  submittedAt: Date;

  @Prop({ trim: true })
  remark?: string;

  @Prop({ type: [TaskProofSchema], default: [] })
  proofs: TaskProof[];

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.SUBMITTED,
  })
  status: TaskStatus;

  @Prop({ trim: true })
  reviewComment?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  reviewedBy?: Employee;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: Number })
  rating?: number;
}
export const TaskSubmissionRecordSchema = SchemaFactory.createForClass(TaskSubmissionRecord);

@Schema({ timestamps: true, collection: 'task_assignees' })
export class TaskAssignee {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true, index: true })
  task: Task;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Employee;

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Date })
  lastSubmittedAt?: Date;

  @Prop({ type: Number, default: 0 })
  submissionCount: number;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  lastUpdateAt?: Date;

  @Prop({ trim: true })
  latestRemark?: string;

  @Prop({ type: [TaskProofSchema], default: [] })
  proofs: TaskProof[];

  @Prop({ type: Number, min: 0, max: 100 })
  rating?: number;

  @Prop({ trim: true })
  approvalComment?: string;

  @Prop({ type: Number })
  submissionRank?: number;

  @Prop({ trim: true })
  taskItemId?: string;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee' })
  approvedBy?: Employee;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({
    type: [
      {
        reason: { type: String, required: true },
        rejectedBy: { type: MongooseSchema.Types.ObjectId, ref: 'Employee' },
        rejectedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  rejectionHistory: Array<{
    reason: string;
    rejectedBy?: Employee;
    rejectedAt?: Date;
  }>;

  @Prop({ type: [TaskSubmissionRecordSchema], default: [] })
  submissionHistory: TaskSubmissionRecord[];
}

export const TaskAssigneeSchema = SchemaFactory.createForClass(TaskAssignee);

TaskAssigneeSchema.index({ task: 1, employee: 1 }, { unique: true });
TaskAssigneeSchema.index({ employee: 1, status: 1 });
TaskAssigneeSchema.index({ task: 1, status: 1 });
