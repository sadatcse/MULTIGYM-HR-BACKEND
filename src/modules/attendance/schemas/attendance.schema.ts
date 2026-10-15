import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Biometric device (ZKTeco etc.). Devices that push via ADMS register
// themselves on first contact as "pending" and only feed attendance once an
// admin activates them and assigns their branch.
// ---------------------------------------------------------------------------
export type AttendanceDeviceDocument = HydratedDocument<AttendanceDevice>;

@Schema({ timestamps: true, collection: 'attendance_devices' })
export class AttendanceDevice {
  @Prop({ required: true, unique: true, trim: true })
  serialNumber: string;

  @Prop({ trim: true, default: '' })
  name: string;

  @Prop({ trim: true, default: '' })
  branch: string;

  @Prop({ trim: true, default: 'ZKTeco' })
  model: string;

  @Prop({ trim: true, default: '' })
  ipAddress: string;

  @Prop({ enum: ['pending', 'active', 'disabled'], default: 'pending' })
  status: string;

  @Prop({ type: Date, default: null })
  lastSeenAt: Date | null;

  @Prop({ type: Date, default: null })
  lastPunchAt: Date | null;

  @Prop({ trim: true, default: '' })
  lastStamp: string;

  @Prop({ type: Number, default: 0 })
  totalPunches: number;
}
export const AttendanceDeviceSchema = SchemaFactory.createForClass(AttendanceDevice);

// ---------------------------------------------------------------------------
// Raw punch as received. Never edited — corrections are applied to the daily
// record, so the original device evidence is always preserved.
// ---------------------------------------------------------------------------
export type AttendancePunchDocument = HydratedDocument<AttendancePunch>;

@Schema({ timestamps: true, collection: 'attendance_punches' })
export class AttendancePunch {
  @Prop({ type: Types.ObjectId, ref: 'Employee', index: true, default: null })
  employee: Types.ObjectId | null;

  @Prop({ trim: true, index: true })
  deviceUserId: string;

  @Prop({ required: true, type: Date, index: true })
  punchTime: Date;

  // Business-local date/time of the punch.
  @Prop({ required: true, trim: true, index: true })
  date: string;

  @Prop({ required: true, trim: true })
  time: string;

  @Prop({ trim: true, default: '' })
  deviceSerial: string;

  @Prop({ trim: true, default: '' })
  branch: string;

  @Prop({ enum: ['device', 'import', 'manual', 'app'], default: 'device' })
  source: string;

  @Prop({ trim: true, default: '' })
  verifyMode: string;

  @Prop({ trim: true, default: '' })
  punchState: string;
}
export const AttendancePunchSchema = SchemaFactory.createForClass(AttendancePunch);
AttendancePunchSchema.index({ deviceUserId: 1, punchTime: 1, deviceSerial: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// One processed day per employee.
// ---------------------------------------------------------------------------
export const ATTENDANCE_STATUSES = ['present', 'late', 'half_day', 'absent', 'leave', 'missing_punch', 'weekend', 'holiday'] as const;

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;

@Schema({ timestamps: true, collection: 'attendance_records' })
export class AttendanceRecord {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ required: true, trim: true, index: true })
  date: string;

  // Expected duty window for the day (from roster / profile / defaults).
  @Prop({ trim: true, default: '' })
  shiftStart: string;

  @Prop({ trim: true, default: '' })
  shiftEnd: string;

  @Prop({ trim: true, default: '' })
  shiftSource: string; // 'roster' | 'profile' | 'default'

  @Prop({ trim: true, default: '' })
  inTime: string;

  @Prop({ trim: true, default: '' })
  outTime: string;

  @Prop({ type: Number, default: 0 })
  punchCount: number;

  @Prop({ required: true, enum: ATTENDANCE_STATUSES, index: true })
  status: string;

  @Prop({ type: Boolean, default: false })
  isLate: boolean;

  @Prop({ type: Number, default: 0 })
  lateMinutes: number;

  @Prop({ type: Boolean, default: false })
  isEarlyLeave: boolean;

  @Prop({ type: Number, default: 0 })
  earlyLeaveMinutes: number;

  @Prop({ type: Number, default: 0 })
  workedMinutes: number;

  @Prop({ type: Number, default: 0 })
  overtimeMinutes: number;

  @Prop({ trim: true, default: '' })
  leaveTypeName: string;

  @Prop({ trim: true, default: '' })
  remarks: string;

  // Set once a person corrects the record — automatic reprocessing then
  // leaves it alone unless explicitly forced.
  @Prop({ type: Boolean, default: false })
  isManual: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  lastEditedBy: { id: string; name: string; role: string; at: Date } | null;
}
export const AttendanceRecordSchema = SchemaFactory.createForClass(AttendanceRecord);
AttendanceRecordSchema.index({ employee: 1, date: 1 }, { unique: true });
AttendanceRecordSchema.index({ date: 1, branch: 1, status: 1 });

// ---------------------------------------------------------------------------
// Audit trail of every manual correction: who, when, what changed, why.
// ---------------------------------------------------------------------------
export type AttendanceCorrectionDocument = HydratedDocument<AttendanceCorrection>;

@Schema({ timestamps: true, collection: 'attendance_corrections' })
export class AttendanceCorrection {
  @Prop({ type: Types.ObjectId, ref: 'AttendanceRecord', index: true })
  record: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ trim: true, index: true })
  date: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  before: { status: string; inTime: string; outTime: string; remarks?: string } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  after: { status: string; inTime: string; outTime: string; remarks?: string } | null;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  editedBy: { id: string; name: string; role: string };

  @Prop({ trim: true, default: '' })
  ipAddress: string;
}
export const AttendanceCorrectionSchema = SchemaFactory.createForClass(AttendanceCorrection);
AttendanceCorrectionSchema.index({ createdAt: -1 });
