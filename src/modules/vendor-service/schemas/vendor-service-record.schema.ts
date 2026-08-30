import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type VendorServiceRecordDocument = HydratedDocument<VendorServiceRecord>;

@Schema({ timestamps: true })
export class VendorServiceRecord {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ trim: true })
  serviceType?: string;

  @Prop({ required: [true, 'Service date is required'] })
  serviceDate: Date;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  assignedTechnician?: string;

  @Prop({ trim: true })
  serviceRequestRef?: string;

  @Prop({ enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' })
  completionStatus: string;

  @Prop({ min: 0 })
  serviceCost?: number;

  @Prop()
  nextServiceDate?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'VendorContract' })
  maintenanceContract?: Types.ObjectId;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ trim: true })
  branch?: string;

  @Prop({ trim: true })
  department?: string;
}

export const VendorServiceRecordSchema = SchemaFactory.createForClass(VendorServiceRecord);
VendorServiceRecordSchema.index({ vendor: 1, serviceDate: -1 });
VendorServiceRecordSchema.index({ nextServiceDate: 1 });
