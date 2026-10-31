import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdvancePolicyDocument = AdvancePolicy & Document;

@Schema({ timestamps: true, collection: 'advancepolicies' })
export class AdvancePolicy {
  @Prop({ required: [true, 'Policy name is required'], trim: true, unique: true })
  policyName: string;

  @Prop({ required: true, type: Number, default: 50 })
  maxAdvancePercent: number;

  @Prop({ required: true, type: Number, default: 2 })
  maxAdvanceCount: number;

  @Prop({ required: true, trim: true, default: 'salary_deduction' })
  defaultDeductionType: string;

  @Prop({ required: true, type: Number, default: 3 })
  minServiceMonths: number;

  // Longest recovery period in months (0 = no limit).
  @Prop({ type: Number, default: 3 })
  maxInstallments: number;

  // Absolute cap on one advance (0 = only the % of gross applies).
  @Prop({ type: Number, default: 0 })
  maxAmount: number;

  // A second advance while one is still being recovered.
  @Prop({ enum: ['yes', 'no'], default: 'no' })
  allowConcurrent: string;

  @Prop({ enum: ['yes', 'no'], default: 'no' })
  allowDuringProbation: string;

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const AdvancePolicySchema = SchemaFactory.createForClass(AdvancePolicy);
AdvancePolicySchema.index({ policyName: 1 }, { unique: true });
