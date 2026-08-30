import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type VendorPurchaseDocument = HydratedDocument<VendorPurchase>;

@Schema({ _id: false })
export class PurchaseWarranty {
  @Prop({ default: false })
  available: boolean;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  durationMonths?: number;

  @Prop({ trim: true })
  serialNumber?: string;

  @Prop({ trim: true })
  assetId?: string;
}
export const PurchaseWarrantySchema = SchemaFactory.createForClass(PurchaseWarranty);

@Schema({ timestamps: true })
export class VendorPurchase {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ required: [true, 'Purchase date is required'] })
  purchaseDate: Date;

  @Prop({ trim: true })
  invoiceNumber?: string;

  @Prop({ required: [true, 'Product name is required'], trim: true })
  productName: string;

  @Prop({ trim: true })
  productCategory?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: 1, min: 1 })
  quantity: number;

  @Prop({ required: [true, 'Unit price is required'], min: 0 })
  unitPrice: number;

  @Prop({ min: 0 })
  totalPrice: number;

  @Prop({ trim: true })
  purchaseOrderNumber?: string;

  @Prop({ enum: ['paid', 'partial', 'pending', 'overdue'], default: 'pending' })
  paymentStatus: string;

  @Prop()
  paymentDate?: Date;

  @Prop({ trim: true })
  department?: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  branch?: string;

  @Prop({ type: PurchaseWarrantySchema, default: () => ({}) })
  warranty: PurchaseWarranty;
}

export const VendorPurchaseSchema = SchemaFactory.createForClass(VendorPurchase);

// totalPrice is (re)computed in the service layer for both create and
// update, since update needs the merged quantity/unitPrice which a plain
// pre-save hook can't see on a findByIdAndUpdate path.

VendorPurchaseSchema.index({ vendor: 1, purchaseDate: -1 });
VendorPurchaseSchema.index({ 'warranty.endDate': 1 });
