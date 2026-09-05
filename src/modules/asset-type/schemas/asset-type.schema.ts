import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssetTypeDocument = HydratedDocument<AssetType>;

@Schema({ timestamps: true })
export class AssetType {
  @Prop({ required: [true, 'Asset type name is required'], trim: true, unique: true })
  name: string;

  @Prop({
    required: true,
    trim: true,
    default: 'Company Assets',
  })
  category: string;

  // individual = serialized/unique (a laptop); inventory = quantity-tracked (t-shirts)
  @Prop({ required: true, enum: ['individual', 'inventory'], default: 'inventory' })
  trackingType: string;

  // Some items (e.g. a one-time uniform giveaway) are issued once and never
  // expected back — assignments of such a type skip the return action and
  // never appear as a pending return or exit-clearance blocker.
  @Prop({ default: true })
  returnable: boolean;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  description: string;

  // Configuration flags
  @Prop({ default: false })
  requiresSerialNumber: boolean;

  @Prop({ default: false })
  requiresSize: boolean;

  @Prop({ default: true })
  requiresCondition: boolean;

  @Prop({ default: true })
  requiresEmployeeAssignment: boolean;

  @Prop({ default: false })
  requiresBranch: boolean;

  @Prop({ default: false })
  requiresDepartment: boolean;

  @Prop({ default: false })
  quantityBased: boolean;

  @Prop({ default: false })
  individualBased: boolean;

  // Only meaningful for returnable/tracked items (e.g. re-issue a uniform every 6 months).
  @Prop()
  replacementIntervalMonths?: number;
}

export const AssetTypeSchema = SchemaFactory.createForClass(AssetType);

AssetTypeSchema.index({ name: 1 }, { unique: true });
AssetTypeSchema.index({ order: 1 }, { unique: true });
