import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskCategoryDocument = TaskCategory & Document;

@Schema({ timestamps: true, collection: 'task_categories' })
export class TaskCategory {
  @Prop({ required: [true, 'Category name is required'], unique: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ default: 1 })
  order: number;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ default: false })
  isSystem: boolean;
}

export const TaskCategorySchema = SchemaFactory.createForClass(TaskCategory);

TaskCategorySchema.index({ name: 1 }, { unique: true });
TaskCategorySchema.index({ order: 1 });
