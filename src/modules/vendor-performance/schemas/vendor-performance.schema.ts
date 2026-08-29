import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type VendorPerformanceDocument = HydratedDocument<VendorPerformance>;

@Schema({ timestamps: true })
export class VendorPerformance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ default: () => new Date() })
  reviewDate: Date;

  @Prop({ trim: true })
  reviewedBy?: string;

  @Prop({ required: true, min: 1, max: 5 })
  serviceQuality: number;

  @Prop({ required: true, min: 1, max: 5 })
  responseTime: number;

  @Prop({ required: true, min: 1, max: 5 })
  productQuality: number;

  @Prop({ required: true, min: 1, max: 5 })
  pricing: number;

  @Prop({ required: true, min: 1, max: 5 })
  reliability: number;

  @Prop({ min: 1, max: 5 })
  overallRating: number;

  @Prop({ trim: true })
  remarks?: string;
}

export const VendorPerformanceSchema = SchemaFactory.createForClass(VendorPerformance);

VendorPerformanceSchema.pre('save', function (next) {
  this.overallRating =
    (this.serviceQuality + this.responseTime + this.productQuality + this.pricing + this.reliability) / 5;
  next();
});

VendorPerformanceSchema.index({ vendor: 1, reviewDate: -1 });
