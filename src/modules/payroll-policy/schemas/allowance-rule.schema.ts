import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export const ALLOWANCE_KINDS = ['roster_duty', 'off_day_work', 'perfect_attendance', 'per_present_day', 'monthly_fixed'] as const;

export type AllowanceRuleDocument = HydratedDocument<AllowanceRule>;

// An allowance that payroll adds automatically from attendance / roster:
//  roster_duty        — per rostered duty attended (opening, closing, night…)
//  off_day_work       — per day worked on a holiday or weekly off
//  perfect_attendance — once a month within absence / late limits
//  per_present_day    — per day worked (meal, transport)
//  monthly_fixed      — a fixed monthly amount for a group (mobile bill)
@Schema({ timestamps: true, collection: 'allowance_rules' })
export class AllowanceRule {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ALLOWANCE_KINDS })
  kind: string;

  // off_day_work only: 'day_rate' pays amount × the employee's day rate.
  @Prop({ enum: ['fixed', 'day_rate'], default: 'fixed' })
  amountType: string;

  @Prop({ type: Number, default: 0 })
  amount: number;

  @Prop({ type: [String], default: [] })
  dutyTypes: string[];

  @Prop({ type: [String], default: [] })
  dayTypes: string[];

  // off_day_work: pay this instead of overtime for those days.
  @Prop({ type: Boolean, default: true })
  replacesOvertime: boolean;

  @Prop({ type: Number, default: 0 })
  maxAbsent: number;

  @Prop({ type: Number, default: 0 })
  maxLate: number;

  // Empty lists = everyone.
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  appliesTo: { designations?: string[]; branches?: string[]; roles?: string[]; employeeTypes?: string[] };

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  updatedBy: { id: string; name: string } | null;
}

export const AllowanceRuleSchema = SchemaFactory.createForClass(AllowanceRule);
