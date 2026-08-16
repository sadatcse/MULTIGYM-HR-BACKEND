import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LatePolicyDocument = LatePolicy & Document;

@Schema({ timestamps: true, collection: 'latepolicies' })
export class LatePolicy {
  @Prop({ required: [true, 'Policy name is required'], trim: true, unique: true })
  policyName: string;

  @Prop({ required: true, enum: ['window', 'nearest_shift'], default: 'window' })
  matchingMethod: string;

  @Prop({ required: true, enum: ['any_punch', 'both_punches'], default: 'both_punches' })
  presentRule: string;

  @Prop({ required: true, type: Number, default: 15 })
  graceBeforeStart: number;

  @Prop({ required: true, type: Number, default: 15 })
  graceAfterEnd: number;

  @Prop({ required: true, type: Number, default: 15 })
  lateTolerance: number;

  @Prop({ required: true, enum: ['fixed', 'per_minute', 'per_day', 'salary_wise'], default: 'per_minute' })
  deductionType: string;

  @Prop({ required: true, type: Number, default: 5 })
  deductionAmount: number;

  @Prop({ required: true, type: Number, default: 3 })
  maxLateAllowedPerMonth: number;

  @Prop({ required: true, enum: ['yes', 'no'], default: 'no' })
  lateCountAsAbsent: string;

  @Prop({ required: true, enum: ['yes', 'no'], default: 'yes' })
  compensatedLate: string;

  @Prop({ required: true, type: Number, default: 15 })
  earlyExitTolerance: number;

  @Prop({ required: true, type: Number, default: 3 })
  maxEarlyExitsAllowedPerMonth: number;

  @Prop({ required: true, enum: ['yes', 'no'], default: 'yes' })
  compensatedEarlyExit: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const LatePolicySchema = SchemaFactory.createForClass(LatePolicy);
LatePolicySchema.index({ policyName: 1 }, { unique: true });
