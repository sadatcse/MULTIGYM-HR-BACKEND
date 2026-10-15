import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

type NamedAmount = { name: string; amount: number };
const NamedAmountList = [{ name: { type: String, required: true }, amount: { type: Number, default: 0 } }];

// ---------------------------------------------------------------------------
// Salary structure — one current structure per employee, with every change
// kept in `revisions` (and mirrored into employee history).
// ---------------------------------------------------------------------------
export type SalaryStructureDocument = HydratedDocument<SalaryStructure>;

@Schema({ timestamps: true, collection: 'salary_structures' })
export class SalaryStructure {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, unique: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ type: Number, default: 0 })
  basic: number;

  @Prop({ type: Number, default: 0 })
  houseRent: number;

  @Prop({ type: Number, default: 0 })
  medical: number;

  @Prop({ type: Number, default: 0 })
  conveyance: number;

  @Prop({ type: NamedAmountList, default: [] })
  otherAllowances: NamedAmount[];

  // Recurring monthly deductions (PF, tax, etc.).
  @Prop({ type: NamedAmountList, default: [] })
  fixedDeductions: NamedAmount[];

  @Prop({ type: Number, default: 0 })
  gross: number;

  @Prop({ enum: ['cash', 'bank', 'mobile_banking'], default: 'cash' })
  paymentMode: string;

  @Prop({ trim: true, default: '' })
  accountNumber: string;

  @Prop({ trim: true, default: '' })
  effectiveFrom: string;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  revisions: Array<{
    type: 'initial' | 'increment' | 'revision' | 'decrement';
    effectiveFrom: string;
    previousBasic: number;
    newBasic: number;
    previousGross: number;
    newGross: number;
    remarks: string;
    by: { id: string; name: string };
    at: Date;
  }>;
}
export const SalaryStructureSchema = SchemaFactory.createForClass(SalaryStructure);

// ---------------------------------------------------------------------------
// Advance salary / loan with monthly installment recovery.
// ---------------------------------------------------------------------------
export type EmployeeLoanDocument = HydratedDocument<EmployeeLoan>;

@Schema({ timestamps: true, collection: 'employee_loans' })
export class EmployeeLoan {
  @Prop({ required: true, unique: true, trim: true })
  loanNo: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ enum: ['advance', 'loan', 'adjustment'], default: 'advance' })
  type: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, type: Number })
  installmentAmount: number;

  // First payroll month the installment is deducted ("YYYY-MM").
  @Prop({ required: true, trim: true })
  startMonth: string;

  @Prop({ type: Number, default: 0 })
  recoveredAmount: number;

  @Prop({ enum: ['active', 'completed', 'cancelled'], default: 'active', index: true })
  status: string;

  @Prop({ trim: true, default: '' })
  reason: string;

  @Prop({ trim: true, default: '' })
  disbursedOn: string;

  @Prop({ type: [{ month: String, amount: Number, run: String, at: Date }], default: [] })
  recoveries: Array<{ month: string; amount: number; run: string; at: Date }>;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  approvedBy: { id: string; name: string } | null;
}
export const EmployeeLoanSchema = SchemaFactory.createForClass(EmployeeLoan);

// ---------------------------------------------------------------------------
// One-off monthly items: bonus, arrear, extra allowance or deduction.
// ---------------------------------------------------------------------------
export type PayrollAdjustmentDocument = HydratedDocument<PayrollAdjustment>;

@Schema({ timestamps: true, collection: 'payroll_adjustments' })
export class PayrollAdjustment {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ required: true, trim: true, index: true })
  month: string;

  @Prop({ required: true, enum: ['bonus', 'allowance', 'arrear', 'incentive', 'deduction'] })
  type: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  createdBy: { id: string; name: string } | null;
}
export const PayrollAdjustmentSchema = SchemaFactory.createForClass(PayrollAdjustment);

// ---------------------------------------------------------------------------
// Payroll run (one per month per branch scope) and its payslips.
// ---------------------------------------------------------------------------
export type PayrollRunDocument = HydratedDocument<PayrollRun>;

@Schema({ timestamps: true, collection: 'payroll_runs' })
export class PayrollRun {
  @Prop({ required: true, trim: true, index: true })
  month: string;

  // Branch name, or "all" for a combined head-office run.
  @Prop({ required: true, trim: true, default: 'all' })
  branch: string;

  @Prop({ enum: ['draft', 'finalized', 'paid'], default: 'draft', index: true })
  status: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  totals: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  employeeCount: number;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  generatedBy: { id: string; name: string } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  finalizedBy: { id: string; name: string; at: Date } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  paidBy: { id: string; name: string; at: Date } | null;

  @Prop({ trim: true, default: '' })
  notes: string;
}
export const PayrollRunSchema = SchemaFactory.createForClass(PayrollRun);
PayrollRunSchema.index({ month: 1, branch: 1 }, { unique: true });

export type PayslipDocument = HydratedDocument<Payslip>;

@Schema({ timestamps: true, collection: 'payslips' })
export class Payslip {
  @Prop({ type: Types.ObjectId, ref: 'PayrollRun', required: true, index: true })
  run: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  month: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employee: Types.ObjectId;

  @Prop({ trim: true })
  employeeName: string;

  @Prop({ trim: true })
  employeeCode: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ trim: true })
  department: string;

  @Prop({ trim: true, index: true })
  branch: string;

  @Prop({ trim: true })
  paymentMode: string;

  @Prop({ trim: true })
  accountNumber: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  attendance: {
    daysInMonth: number;
    present: number;
    absent: number;
    late: number;
    lateMinutes: number;
    halfDay: number;
    leave: number;
    unpaidLeave: number;
    weekend: number;
    holiday: number;
    overtimeHours: number;
  };

  @Prop({ type: Number, default: 0 }) basic: number;
  @Prop({ type: Number, default: 0 }) houseRent: number;
  @Prop({ type: Number, default: 0 }) medical: number;
  @Prop({ type: Number, default: 0 }) conveyance: number;
  @Prop({ type: Number, default: 0 }) otherAllowances: number;
  @Prop({ type: Number, default: 0 }) gross: number;
  @Prop({ type: Number, default: 0 }) overtimePay: number;
  @Prop({ type: Number, default: 0 }) bonus: number;
  @Prop({ type: Number, default: 0 }) otherEarnings: number;
  @Prop({ type: Number, default: 0 }) totalEarnings: number;

  @Prop({ type: Number, default: 0 }) lateDeduction: number;
  @Prop({ type: Number, default: 0 }) absentDeduction: number;
  @Prop({ type: Number, default: 0 }) advanceDeduction: number;
  @Prop({ type: Number, default: 0 }) loanDeduction: number;
  @Prop({ type: Number, default: 0 }) fixedDeductions: number;
  @Prop({ type: Number, default: 0 }) otherDeductions: number;
  @Prop({ type: Number, default: 0 }) totalDeductions: number;

  @Prop({ type: Number, default: 0 }) netSalary: number;

  // Line items behind the summed figures (for the payslip print).
  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  lines: Array<{ kind: 'earning' | 'deduction'; label: string; amount: number; ref?: string }>;

  @Prop({ trim: true, default: '' })
  remarks: string;

  @Prop({ type: Boolean, default: false })
  manuallyAdjusted: boolean;
}
export const PayslipSchema = SchemaFactory.createForClass(Payslip);
PayslipSchema.index({ run: 1, employee: 1 }, { unique: true });
