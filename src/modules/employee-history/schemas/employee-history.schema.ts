import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type EmployeeHistoryDocument = HydratedDocument<EmployeeHistory>;

export const HISTORY_EVENT_TYPES = [
  'appointment',
  'confirmation',
  'promotion',
  'demotion',
  'transfer',
  'promotion_transfer',
  'salary_revision',
  'increment',
  'designation_change',
  'department_change',
  'appreciation',
  'warning',
  'show_cause',
  'suspension',
  'reinstatement',
  'resignation',
  'separation',
  'status_change',
  'other',
] as const;

// Snapshot of the career-relevant profile fields before/after an event.
export interface CareerSnapshot {
  designation?: string;
  department?: string;
  branches?: string[];
  basicSalary?: number;
  grossSalary?: number;
  status?: string;
  employeeType?: string;
}

@Schema({ timestamps: true, collection: 'employee_histories' })
export class EmployeeHistory {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeCode?: string;

  @Prop({ trim: true })
  employeeName?: string;

  // Branch at the time of the event — used for branch-scoped listing.
  @Prop({ trim: true, index: true })
  branch?: string;

  @Prop({ required: true, enum: HISTORY_EVENT_TYPES, index: true })
  eventType: string;

  @Prop({ required: true, trim: true, index: true })
  effectiveDate: string;

  @Prop({ trim: true, default: '' })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  from: CareerSnapshot;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  to: CareerSnapshot;

  // Memo / letter number, case number etc.
  @Prop({ trim: true, default: '' })
  referenceNo: string;

  @Prop({ trim: true, default: '' })
  sourceModule: string; // 'manual' | 'employee' | 'payroll' | 'discipline' | 'hr-letter'

  @Prop({ trim: true, default: '' })
  sourceId: string;

  @Prop({ type: [{ name: String, url: String }], default: [] })
  attachments: Array<{ name: string; url: string }>;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  recordedBy: { id: string; name: string; role: string } | null;
}

export const EmployeeHistorySchema = SchemaFactory.createForClass(EmployeeHistory);
EmployeeHistorySchema.index({ employee: 1, effectiveDate: -1 });
