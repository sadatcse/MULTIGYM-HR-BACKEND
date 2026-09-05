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
export class PurchaseItem {
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

  @Prop({ type: PurchaseWarrantySchema, default: () => ({}) })
  warranty: PurchaseWarranty;
}
export const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ timestamps: true })
export class PurchasePayment {
  @Prop({ required: [true, 'Payment amount is required'], min: 0.01 })
  amount: number;

  @Prop({ required: [true, 'Payment date is required'] })
  paymentDate: Date;

  @Prop({ enum: ['cash', 'bank-transfer', 'cheque', 'mobile-banking', 'card', 'other'], default: 'cash' })
  method: string;

  @Prop({ trim: true })
  reference?: string;

  @Prop({ trim: true })
  note?: string;

  @Prop({ trim: true })
  recordedBy?: string;
}
export const PurchasePaymentSchema = SchemaFactory.createForClass(PurchasePayment);

@Schema({ timestamps: true })
export class VendorPurchase {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ required: [true, 'Purchase date is required'] })
  purchaseDate: Date;

  @Prop({ trim: true })
  invoiceNumber?: string;

  @Prop({ trim: true })
  purchaseOrderNumber?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  department?: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  branch?: string;

  @Prop()
  dueDate?: Date;

  @Prop({ type: [PurchaseItemSchema], default: [], validate: [(v: any[]) => v.length > 0, 'At least one product item is required'] })
  items: PurchaseItem[];

  @Prop({ type: [PurchasePaymentSchema], default: [] })
  payments: PurchasePayment[];

  // totalAmount/amountPaid/amountDue/paymentStatus are all derived, stored
  // fields — recomputed by the service on every write (create, update,
  // addPayment, removePayment), never set directly by a client. Kept as
  // real stored fields (rather than computed-on-read like warranty/contract
  // status) so existing Mongo $match/$group aggregations on paymentStatus
  // and totals keep working unchanged.
  @Prop({ min: 0, default: 0 })
  totalAmount: number;

  @Prop({ min: 0, default: 0 })
  amountPaid: number;

  @Prop({ min: 0, default: 0 })
  amountDue: number;

  @Prop({ enum: ['paid', 'partial', 'pending', 'overdue'], default: 'pending' })
  paymentStatus: string;
}

export const VendorPurchaseSchema = SchemaFactory.createForClass(VendorPurchase);

VendorPurchaseSchema.index({ vendor: 1, purchaseDate: -1 });
VendorPurchaseSchema.index({ 'items.warranty.endDate': 1 });
