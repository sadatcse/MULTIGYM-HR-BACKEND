import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type BonusPolicyDocument = BonusPolicy & Document;

@Schema({ timestamps: true, collection: 'bonuspolicies' })
export class BonusPolicy {
  @Prop({ required: [true, 'Policy name is required'], trim: true, unique: true })
  policyName: string;

  @Prop({ required: true, enum: ['Festival', 'Performance', 'Attendance', 'Annual', 'Custom'], default: 'Festival' })
  bonusType: string;

  @Prop({ required: true, enum: ['percentage_of_basic', 'percentage_of_gross', 'fixed_amount'], default: 'percentage_of_basic' })
  calculationType: string;

  @Prop({ required: true, type: Number, default: 50 })
  bonusRate: number;

  @Prop({ trim: true, default: '' })
  applicableMonth: string;

  // ---- Eligibility (used when the bonus is run into payroll) ----
  @Prop({ type: Number, default: 0 })
  minServiceMonths: number;

  // service_months: under a year of service gets months/12 of the bonus.
  @Prop({ enum: ['none', 'service_months'], default: 'none' })
  proRata: string;

  @Prop({ enum: ['yes', 'no'], default: 'no' })
  excludeProbation: string;

  // Attendance limits in the payout month (-1 = no limit).
  @Prop({ type: Number, default: -1 })
  maxAbsentDays: number;

  @Prop({ type: Number, default: -1 })
  maxLateDays: number;

  // Empty lists = everyone.
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  appliesTo: { designations?: string[]; branches?: string[]; employeeTypes?: string[] };

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const BonusPolicySchema = SchemaFactory.createForClass(BonusPolicy);
BonusPolicySchema.index({ policyName: 1 }, { unique: true });
