import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type VendorContractDocument = HydratedDocument<VendorContract>;

@Schema({ timestamps: true })
export class VendorContract {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ trim: true })
  contractType?: string;

  @Prop({ trim: true })
  contractNumber?: string;

  @Prop({ required: [true, 'Start date is required'] })
  startDate: Date;

  @Prop({ required: [true, 'End date is required'] })
  endDate: Date;

  @Prop({ min: 0 })
  value?: number;

  @Prop({ trim: true })
  terms?: string;

  @Prop({ default: false })
  autoRenew: boolean;

  // Stored so a manual "terminated" call can be preserved; active/expiring/
  // expired are otherwise recomputed live from endDate in the service layer.
  @Prop({ enum: ['active', 'expiring', 'expired', 'terminated'], default: 'active' })
  status: string;

  @Prop({ trim: true })
  remarks?: string;
}

export const VendorContractSchema = SchemaFactory.createForClass(VendorContract);
VendorContractSchema.index({ vendor: 1, endDate: -1 });
