import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OvertimePolicyDocument = OvertimePolicy & Document;

@Schema({ timestamps: true, collection: 'overtimepolicies' })
export class OvertimePolicy {
  @Prop({ required: [true, 'Policy name is required'], trim: true, unique: true })
  policyName: string;

  @Prop({ required: true, type: Number, default: 1.5 })
  ratePerHour: number;

  @Prop({ required: true, type: Number, default: 40 })
  maxHoursPerMonth: number;

  @Prop({ required: true, type: Number, default: 30 })
  minOvertimeMinutes: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const OvertimePolicySchema = SchemaFactory.createForClass(OvertimePolicy);
OvertimePolicySchema.index({ policyName: 1 }, { unique: true });
