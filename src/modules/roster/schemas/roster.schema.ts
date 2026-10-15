import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const DUTY_TYPES = ['morning', 'evening', 'full_day', 'friday', 'special', 'opening', 'closing', 'night', 'off'] as const;

export const DUTY_TYPE_LABELS: Record<string, string> = {
  morning: 'Morning Shift',
  evening: 'Evening Shift',
  full_day: 'Full Day',
  friday: 'Friday Duty',
  special: 'Special Duty',
  opening: 'Opening Duty',
  closing: 'Closing Duty',
  night: 'Night Shift',
  off: 'Day Off',
};

export type RosterAssignmentDocument = HydratedDocument<RosterAssignment>;

// One duty for one employee on one date at one branch. An employee may hold
// several duties the same day (e.g. Opening + Morning), but never the same
// duty type twice on a date.
@Schema({ timestamps: true, collection: 'roster_assignments' })
export class RosterAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ required: true, trim: true, index: true })
  branch: string;

  @Prop({ required: true, trim: true, index: true })
  date: string;

  @Prop({ required: true, enum: DUTY_TYPES })
  dutyType: string;

  @Prop({ trim: true, default: '' })
  startTime: string;

  @Prop({ trim: true, default: '' })
  endTime: string;

  // Temporary change (swap / cover) as opposed to the regular plan.
  @Prop({ type: Boolean, default: false })
  isTemporary: boolean;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  createdBy: { id: string; name: string } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  updatedBy: { id: string; name: string } | null;
}

export const RosterAssignmentSchema = SchemaFactory.createForClass(RosterAssignment);
RosterAssignmentSchema.index({ employee: 1, date: 1, dutyType: 1 }, { unique: true });
RosterAssignmentSchema.index({ branch: 1, date: 1 });

export type RosterChangeLogDocument = HydratedDocument<RosterChangeLog>;

@Schema({ timestamps: true, collection: 'roster_change_logs' })
export class RosterChangeLog {
  @Prop({ type: Types.ObjectId, ref: 'Employee', index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ trim: true, index: true })
  date: string;

  @Prop({ enum: ['created', 'updated', 'deleted', 'copied'], required: true })
  action: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  before: any;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  after: any;

  @Prop({ trim: true, default: '' })
  reason: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  changedBy: { id: string; name: string; role: string } | null;
}

export const RosterChangeLogSchema = SchemaFactory.createForClass(RosterChangeLog);
RosterChangeLogSchema.index({ createdAt: -1 });
