import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Address, AddressSchema } from '../../user/schemas/employee.schema';

export type VendorDocument = HydratedDocument<Vendor>;

@Schema({ _id: false })
export class VendorContactPerson {
  @Prop() name?: string;
  @Prop() designation?: string;
  @Prop() phone?: string;
  @Prop() email?: string;
}
export const VendorContactPersonSchema = SchemaFactory.createForClass(VendorContactPerson);

@Schema({ _id: false })
export class VendorBusinessInfo {
  @Prop() registrationNumber?: string;
  @Prop() businessType?: string;
}
export const VendorBusinessInfoSchema = SchemaFactory.createForClass(VendorBusinessInfo);

@Schema({ timestamps: true })
export class Vendor {
  @Prop({ required: [true, 'Please provide the vendor/company name'], trim: true, unique: true })
  name: string;

  @Prop({ trim: true })
  category?: string;

  @Prop({ type: AddressSchema })
  address?: Address;

  @Prop({ type: VendorContactPersonSchema })
  contactPerson1?: VendorContactPerson;

  @Prop({ type: VendorContactPersonSchema })
  contactPerson2?: VendorContactPerson;

  @Prop({ type: [String], default: [] })
  phones: string[];

  @Prop({ type: [String], default: [] })
  emails: string[];

  @Prop()
  website?: string;

  @Prop({ type: VendorBusinessInfoSchema })
  businessInfo?: VendorBusinessInfo;

  @Prop()
  taxVatNumber?: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  notes: string;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
VendorSchema.index({ name: 1 }, { unique: true });
VendorSchema.index({ category: 1 });
VendorSchema.index({ status: 1 });
