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

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const AdvancePolicySchema = SchemaFactory.createForClass(AdvancePolicy);
AdvancePolicySchema.index({ policyName: 1 }, { unique: true });
