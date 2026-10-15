import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type LeaveApplicationDocument = HydratedDocument<LeaveApplication>;

// Workflow: Employee -> Branch / Floor In-Charge verification ->
// Manager (Admin & HR) verification -> Director approval.
export const LEAVE_STATUSES = ['pending_branch', 'pending_hr', 'pending_director', 'approved', 'rejected', 'cancelled'] as const;
export const LEAVE_STAGES = ['branch', 'hr', 'director'] as const;
export const RECOMMENDATIONS = ['recommended', 'partially_recommended', 'not_recommended'] as const;
export const FINAL_DECISIONS = ['approved', 'partially_approved', 'rejected'] as const;

export interface LeaveStageAction {
  stage: 'branch' | 'hr' | 'director';
  decision: string; // recommendation for branch/hr, final decision for director
  recommendedDays?: number;
  remarks?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actedAt: Date;
}

@Schema({ timestamps: true, collection: 'leave_applications' })
export class LeaveApplication {
  @Prop({ required: true, unique: true, trim: true })
  applicationNo: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true })
  employeePhoto: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ trim: true })
  department: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ type: Types.ObjectId, ref: 'LeaveType', required: true })
  leaveType: Types.ObjectId;

  @Prop({ trim: true })
  leaveTypeName: string;

  @Prop({ type: Boolean, default: true })
  isPaid: boolean;

  @Prop({ required: true, trim: true, index: true })
  fromDate: string;

  @Prop({ required: true, trim: true, index: true })
  toDate: string;

  @Prop({ type: Boolean, default: false })
  halfDay: boolean;

  @Prop({ required: true, type: Number })
  totalDays: number;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true, default: '' })
  contactDuringLeave: string;

  // Who covers the duty while away.
  @Prop({ trim: true, default: '' })
  handoverTo: string;

  @Prop({ type: [{ name: String, url: String, kind: String }], default: [] })
  attachments: Array<{ name: string; url: string; kind?: string }>;

  // Snapshot of the employee's leave record at application time — the
  // "Previous Leave Record" column of the paper form.
  @Prop({ type: SchemaTypes.Mixed, default: null })
  previousLeaveRecord: {
    year: number;
    balances: Array<{ leaveTypeId: string; leaveTypeName: string; allowed: number; taken: number; remaining: number }>;
    totalTakenThisYear: number;
    lastLeave: { fromDate: string; toDate: string; days: number; leaveTypeName: string } | null;
  } | null;

  @Prop({ required: true, enum: LEAVE_STATUSES, default: 'pending_branch', index: true })
  status: string;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  actions: LeaveStageAction[];

  // Final outcome (set at director approval). A partial approval may grant
  // fewer days / a narrower date range than requested.
  @Prop({ type: Number, default: 0 })
  approvedDays: number;

  @Prop({ trim: true, default: '' })
  approvedFromDate: string;

  @Prop({ trim: true, default: '' })
  approvedToDate: string;

  @Prop({ trim: true, default: '' })
  finalRemarks: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  appliedBy: { id: string; name: string; onBehalf: boolean } | null;

  @Prop({ trim: true, default: '' })
  cancelReason: string;
}

export const LeaveApplicationSchema = SchemaFactory.createForClass(LeaveApplication);
LeaveApplicationSchema.index({ employee: 1, fromDate: -1 });
LeaveApplicationSchema.index({ status: 1, branch: 1 });
