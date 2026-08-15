import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobPositionDocument = JobPosition & Document;

@Schema({ timestamps: true })
export class JobPosition {
  @Prop({ required: [true, 'Job position title is required'], trim: true, unique: true })
  title: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: 'General' })
  department: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const JobPositionSchema = SchemaFactory.createForClass(JobPosition);

JobPositionSchema.index({ title: 1 }, { unique: true });
JobPositionSchema.index({ order: 1 }, { unique: true });
