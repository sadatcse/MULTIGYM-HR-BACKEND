import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VendorCategoryDocument = HydratedDocument<VendorCategory>;

@Schema({ timestamps: true })
export class VendorCategory {
  @Prop({ required: [true, 'Vendor category title is required'], trim: true, unique: true })
  title: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const VendorCategorySchema = SchemaFactory.createForClass(VendorCategory);

VendorCategorySchema.index({ title: 1 }, { unique: true });
VendorCategorySchema.index({ order: 1 }, { unique: true });
