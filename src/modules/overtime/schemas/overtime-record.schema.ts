import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const OvertimeRecordSchema = SchemaFactory.createForClass(OvertimeRecord);
OvertimeRecordSchema.index({ recordDate: 1 });
