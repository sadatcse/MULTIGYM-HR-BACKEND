import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const COMMISSION_TARGETS = ['total_sales', 'membership_sales', 'pt_sales', 'pt_sessions', 'new_members'] as const;

export type CommissionPlanDocument = HydratedDocument<CommissionPlan>;

// How trainers and sales staff earn on top of salary: per PT session, a share
// of PT package / membership / supplement sales, per new member, and a bonus
// for reaching a monthly target.
@Schema({ timestamps: true, collection: 'commission_plans' })
export class CommissionPlan {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, default: 0 })
  ptSessionRate: number;

  // Per client on a monthly PT package.
  @Prop({ type: Number, default: 0 })
  ptMonthlyRate: number;

  // Fixed amount per supplement / product item sold.
  @Prop({ type: Number, default: 0 })
  productItemRate: number;

  @Prop({ type: Number, default: 0 })
  ptSalesPercent: number;

  @Prop({ type: Number, default: 0 })
  membershipSalesPercent: number;

  @Prop({ type: Number, default: 0 })
  newMemberRate: number;

  @Prop({ type: Number, default: 0 })
  productSalesPercent: number;

  @Prop({ enum: COMMISSION_TARGETS, default: 'total_sales' })
  targetMetric: string;

  // Highest slab reached pays its bonus.
  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  slabs: Array<{ min: number; bonus: number }>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  appliesTo: { designations?: string[]; branches?: string[]; roles?: string[]; employeeTypes?: string[] };

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  updatedBy: { id: string; name: string } | null;
}
export const CommissionPlanSchema = SchemaFactory.createForClass(CommissionPlan);

export type CommissionEntryDocument = HydratedDocument<CommissionEntry>;

// One employee's sales / PT figures for one month and the commission they
// earn under a plan. Approved entries are paid by that month's payroll.
@Schema({ timestamps: true, collection: 'commission_entries' })
export class CommissionEntry {
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
  month: string;

  @Prop({ type: Types.ObjectId, ref: 'CommissionPlan', required: true })
  plan: Types.ObjectId;

  @Prop({ trim: true })
  planName: string;

  @Prop({ type: Number, default: 0 }) ptSessions: number;
  @Prop({ type: Number, default: 0 }) ptMonthlyClients: number;
  @Prop({ type: Number, default: 0 }) productItems: number;
  @Prop({ type: Number, default: 0 }) ptSalesAmount: number;
  @Prop({ type: Number, default: 0 }) membershipSalesAmount: number;
  @Prop({ type: Number, default: 0 }) newMembers: number;
  @Prop({ type: Number, default: 0 }) productSalesAmount: number;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  breakdown: Array<{ label: string; amount: number }>;

  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ enum: ['draft', 'approved'], default: 'draft', index: true })
  status: string;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  updatedBy: { id: string; name: string; at: Date } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  approvedBy: { id: string; name: string; at: Date } | null;
}
export const CommissionEntrySchema = SchemaFactory.createForClass(CommissionEntry);
CommissionEntrySchema.index({ employee: 1, month: 1 }, { unique: true });
