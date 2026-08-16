import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeaveTypeDocument = LeaveType & Document;

@Schema({ timestamps: true, collection: 'leavetypes' })
export class LeaveType {
  @Prop({ required: [true, 'Leave type name is required'], trim: true, unique: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, enum: ['yes', 'no'], default: 'yes' })
  isPaid: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ required: true, type: Number, default: 12 })
  daysAllowed: number;

  @Prop({ required: true, enum: ['yes', 'no'], default: 'no' })
  carryForward: string;

  @Prop({ required: true, enum: ['All', 'Male', 'Female'], default: 'All' })
  applicableFor: string;

  @Prop({ required: true, type: Number, default: 2026 })
  policyYear: number;

  @Prop({ required: true, type: Number, default: 1 })
  order: number;
}

export const LeaveTypeSchema = SchemaFactory.createForClass(LeaveType);
LeaveTypeSchema.index({ name: 1 }, { unique: true });
LeaveTypeSchema.index({ order: 1 });
