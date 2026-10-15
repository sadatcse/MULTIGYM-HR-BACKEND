import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const CASE_TYPES = ['verbal_warning', 'written_warning', 'show_cause', 'complaint', 'investigation', 'suspension'] as const;
export const CASE_STATUSES = ['open', 'awaiting_reply', 'under_investigation', 'decision_made', 'closed'] as const;
export const ENTRY_TYPES = [
  'note',
  'warning_issued',
  'show_cause_issued',
  'reply_received',
  'investigation',
  'hearing',
  'management_decision',
  'administrative_action',
  'status_change',
  'closed',
] as const;
export const DECISION_ACTIONS = [
  'no_action',
  'counselling',
  'verbal_warning',
  'written_warning',
  'final_warning',
  'suspension',
  'salary_deduction',
  'increment_withheld',
  'demotion',
  'transfer',
  'termination',
  'other',
] as const;

export type DisciplinaryCaseDocument = HydratedDocument<DisciplinaryCase>;

@Schema({ timestamps: true, collection: 'disciplinary_cases' })
export class DisciplinaryCase {
  @Prop({ required: true, unique: true, trim: true })
  caseNo: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true })
  employeePhoto: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ required: true, enum: CASE_TYPES, index: true })
  caseType: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: '' })
  incidentDate: string;

  @Prop({ trim: true, default: '' })
  complainant: string;

  @Prop({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  severity: string;

  @Prop({ required: true, enum: CASE_STATUSES, default: 'open', index: true })
  status: string;

  // Deadline for the employee's written explanation (show cause).
  @Prop({ trim: true, default: '' })
  replyDeadline: string;

  // Linked HR letter (warning letter / show cause notice) if issued.
  @Prop({ trim: true, default: '' })
  letterNumber: string;

  @Prop({ type: [{ name: String, url: String }], default: [] })
  attachments: Array<{ name: string; url: string }>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  entries: Array<{
    _id?: string;
    type: string;
    text: string;
    date: string;
    attachments: Array<{ name: string; url: string }>;
    by: { id: string; name: string; role: string };
    at: Date;
  }>;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  decision: {
    action: string;
    summary: string;
    effectiveDate: string;
    suspensionDays?: number;
    deductionAmount?: number;
    decidedBy: { id: string; name: string; role: string };
    decidedAt: Date;
  } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  createdBy: { id: string; name: string; role: string } | null;

  @Prop({ type: Boolean, default: false })
  confidential: boolean;
}

export const DisciplinaryCaseSchema = SchemaFactory.createForClass(DisciplinaryCase);
DisciplinaryCaseSchema.index({ createdAt: -1 });
