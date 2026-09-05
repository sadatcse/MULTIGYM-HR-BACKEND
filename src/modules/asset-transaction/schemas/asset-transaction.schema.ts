import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AssetTransactionDocument = HydratedDocument<AssetTransaction>;

@Schema({ timestamps: true })
export class AssetTransaction {
  @Prop({ required: true, unique: true, index: true })
  transactionId: string;

  @Prop({
    required: true,
    enum: [
      'PURCHASE',
      'ADD_STOCK',
      'ISSUE',
      'RETURN',
      'PARTIAL_RETURN',
      'TRANSFER',
      'DAMAGED',
      'LOST',
      'REPAIR',
      'REPAIR_COMPLETE',
      'ADJUSTMENT',
      'DISPOSAL',
    ],
    index: true,
  })
  transactionType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Asset', index: true })
  asset?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  assetCode: string;

  @Prop({ trim: true })
  assetName?: string;

  @Prop({ trim: true })
  assetType?: string;

  @Prop({ trim: true })
  size?: string;

  @Prop({ default: 1 })
  quantity: number;

  // Immutable historical employee snapshot fields
  @Prop({ trim: true, index: true })
  employeeName?: string;

  @Prop({ trim: true, index: true })
  employeeCode?: string;

  @Prop({ trim: true })
  departmentName?: string;

  @Prop({ trim: true })
  designationName?: string;

  @Prop({ trim: true })
  branchName?: string;

  // Transfer recipient snapshot (if TRANSFER)
  @Prop({ trim: true })
  toEmployeeName?: string;

  @Prop({ trim: true })
  toEmployeeCode?: string;

  @Prop({ trim: true })
  previousStatus?: string;

  @Prop({ trim: true })
  newStatus?: string;

  @Prop({ trim: true })
  condition?: string;

  @Prop({ trim: true })
  performedBy?: string;

  @Prop({ trim: true, default: '' })
  notes?: string;

  @Prop({ default: Date.now, index: true })
  date: Date;
}

export const AssetTransactionSchema = SchemaFactory.createForClass(AssetTransaction);
AssetTransactionSchema.index({ transactionId: 1 }, { unique: true });
AssetTransactionSchema.index({ assetCode: 1, date: -1 });
AssetTransactionSchema.index({ employeeCode: 1, date: -1 });
AssetTransactionSchema.index({ transactionType: 1, date: -1 });
