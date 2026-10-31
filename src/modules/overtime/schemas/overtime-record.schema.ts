import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type OvertimeRecordDocument = OvertimeRecord & Document;

@Schema({ timestamps: true, collection: 'overtimerecords' })
export class OvertimeRecord {
  @Prop({ required: [true, 'Employee name is required'], trim: true })
  employeeName: string;

  @Prop({ trim: true, default: '' })
  employeeId: string;

  @Prop({ required: [true, 'Record date is required'], trim: true })
  recordDate: string;

  @Prop({ required: true, type: Number, default: 0 })
  overtimeHours: number;

  @Prop({ required: true, type: Number, default: 0 })
  overtimeMinutes: number;

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;

  @Prop({ trim: true, default: '' })
  remarks: string;

  // Linked employee (older records only have the name / staff code above).
  @Prop({ type: Types.ObjectId, ref: 'Employee', index: true, default: null })
  employee: Types.ObjectId | null;

  @Prop({ trim: true, default: '', index: true })
  branch: string;

  @Prop({ trim: true, default: '' })
  department: string;

  @Prop({ trim: true, default: '' })
  designation: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  createdBy: { id: string; name: string } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  decidedBy: { id: string; name: string; at: Date } | null;
}

export const OvertimeRecordSchema = SchemaFactory.createForClass(OvertimeRecord);
OvertimeRecordSchema.index({ recordDate: 1 });
