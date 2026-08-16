import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;
}

export const BonusPolicySchema = SchemaFactory.createForClass(BonusPolicy);
BonusPolicySchema.index({ policyName: 1 }, { unique: true });
