import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Employee/Branch -> Requisition -> Admin Verification -> Management
// Approval -> Purchase -> Received.
export const REQUISITION_STATUSES = ['submitted', 'verified', 'approved', 'purchased', 'received', 'rejected', 'cancelled'] as const;

export type RequisitionDocument = HydratedDocument<Requisition>;

@Schema({ timestamps: true, collection: 'requisitions' })
export class Requisition {
  @Prop({ required: true, unique: true, trim: true })
  requisitionNo: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true, index: true })
  branch: string;

  @Prop({ trim: true, default: '' })
  department: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  requestedBy: { id: string; name: string; employeeCode?: string; designation?: string };

  @Prop({ trim: true, default: '' })
  purpose: string;

  @Prop({ enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' })
  priority: string;

  @Prop({ trim: true, default: '' })
  requiredBy: string;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        specification: { type: String, default: '' },
        quantity: { type: Number, required: true },
        unit: { type: String, default: 'pcs' },
        estimatedUnitPrice: { type: Number, default: 0 },
        approvedQuantity: { type: Number, default: null },
        receivedQuantity: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  items: Array<{
    _id?: Types.ObjectId;
    name: string;
    specification?: string;
    quantity: number;
    unit?: string;
    estimatedUnitPrice?: number;
    approvedQuantity?: number | null;
    receivedQuantity?: number;
  }>;

  @Prop({ type: Number, default: 0 })
  estimatedTotal: number;

  @Prop({
    type: [
      {
        vendorId: { type: String, default: '' },
        vendorName: { type: String, required: true },
        amount: { type: Number, required: true },
        deliveryDays: { type: Number, default: 0 },
        note: { type: String, default: '' },
        attachmentUrl: { type: String, default: '' },
        selected: { type: Boolean, default: false },
        addedBy: { type: String, default: '' },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  quotations: Array<{
    _id?: Types.ObjectId;
    vendorId?: string;
    vendorName: string;
    amount: number;
    deliveryDays?: number;
    note?: string;
    attachmentUrl?: string;
    selected?: boolean;
    addedBy?: string;
    addedAt?: Date;
  }>;

  @Prop({ trim: true, default: '' })
  vendorId: string;

  @Prop({ trim: true, default: '' })
  vendorName: string;

  @Prop({ type: Number, default: 0 })
  approvedAmount: number;

  @Prop({ required: true, enum: REQUISITION_STATUSES, default: 'submitted', index: true })
  status: string;

  @Prop({ enum: ['not_started', 'ordered', 'purchased'], default: 'not_started' })
  purchaseStatus: string;

  @Prop({ enum: ['pending', 'partial', 'delivered'], default: 'pending' })
  deliveryStatus: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  purchase: { date: string; invoiceNo: string; actualAmount: number; paymentMethod: string; note: string } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  receipt: { date: string; receivedBy: string; condition: string; note: string } | null;

  @Prop({ type: [{ name: String, url: String }], default: [] })
  attachments: Array<{ name: string; url: string }>;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  timeline: Array<{ action: string; status: string; remarks: string; stepLabel?: string; by: { id: string; name: string; role: string }; at: Date }>;

  // Tree workflow: route copied from the management tree when raised
  // (nearest level first; each level verifies, the last approves).
  // Requisitions raised before a tree was saved keep admin -> management.
  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  approvalChain: Array<{ roles: string[]; label: string }>;

  @Prop({ type: Number, default: 0 })
  currentStep: number;

  @Prop({ type: [String], default: [], index: true })
  pendingRoles: string[];

  @Prop({ type: [String], default: [] })
  finalRoles: string[];
}

export const RequisitionSchema = SchemaFactory.createForClass(Requisition);
RequisitionSchema.index({ createdAt: -1 });
