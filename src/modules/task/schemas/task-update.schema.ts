import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Task } from './task.schema';
import { Employee } from '../../user/schemas/employee.schema';
import { TaskAttachment, TaskAttachmentSchema } from './task.schema';

export type TaskUpdateDocument = TaskUpdate & Document;

@Schema({ timestamps: true, collection: 'task_updates' })
export class TaskUpdate {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true, index: true })
  task: Task;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true })
  employee: Employee;

  @Prop({ type: Number, min: 0, max: 100 })
  progress?: number;

  @Prop({ trim: true, required: true })
  comment: string;

  @Prop({ type: [TaskAttachmentSchema], default: [] })
  attachments: TaskAttachment[];
}

export const TaskUpdateSchema = SchemaFactory.createForClass(TaskUpdate);

TaskUpdateSchema.index({ task: 1, createdAt: -1 });
