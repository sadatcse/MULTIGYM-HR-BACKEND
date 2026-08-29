import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Named "Attachment" rather than "Document" to avoid colliding with the
// Mongoose `VendorDocument` HydratedDocument type already exported from
// the vendor module — the route/collection is still "vendor documents".
export type VendorAttachmentDocument = HydratedDocument<VendorAttachment>;

@Schema({ timestamps: true })
export class VendorAttachment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ enum: ['vendor', 'purchase', 'service', 'contract'], default: 'vendor' })
  relatedType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  relatedId?: Types.ObjectId;

  @Prop({
    enum: [
      'contract',
      'invoice',
      'purchase-order',
      'warranty-certificate',
      'service-report',
      'vendor-agreement',
      'quotation',
      'other',
    ],
    required: [true, 'Document type is required'],
  })
  documentType: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ required: [true, 'File URL is required'] })
  fileUrl: string;

  @Prop({ trim: true })
  fileName?: string;

  @Prop({ trim: true })
  uploadedBy?: string;
}

export const VendorAttachmentSchema = SchemaFactory.createForClass(VendorAttachment);
VendorAttachmentSchema.index({ vendor: 1, createdAt: -1 });
VendorAttachmentSchema.index({ relatedType: 1, relatedId: 1 });
