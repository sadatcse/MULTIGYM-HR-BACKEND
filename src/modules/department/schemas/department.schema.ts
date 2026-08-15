import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true })
export class Department {
  @Prop({ required: [true, 'Department name is required'], trim: true, unique: true })
  name: string;

  @Prop({ required: [true, 'Display order is required'], default: 1 })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.index({ name: 1 }, { unique: true });
DepartmentSchema.index({ order: 1 });
