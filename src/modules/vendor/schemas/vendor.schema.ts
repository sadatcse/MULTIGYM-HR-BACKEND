import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VendorDocument = HydratedDocument<Vendor>;

@Schema({ timestamps: true })
export class Vendor {
  @Prop({ required: [true, 'Please provide the vendor name'] })
  name: string;

  @Prop({ required: [true, 'Please provide the vendor description'] })
  description: string;

  @Prop({ required: [true, 'Please provide the contact person'] })
  contactPerson: string;

  @Prop({ required: [true, "Please provide the contact person's mobile number"] })
  contactPersonMobile: string;

  @Prop({ required: [true, 'Please provide the vendor phone number'] })
  vendorPhone: string;

  @Prop({ required: [true, 'Please provide the vendor email'] })
  vendorEmail: string;

  @Prop({ required: [true, 'Please provide the vendor address'] })
  vendorAddress: string;

  @Prop({ required: [true, 'Please provide the city'] })
  city: string;

  @Prop({ required: [true, 'Please provide the trade license'] })
  tradeLicense: string;

  @Prop({ type: [String], required: [true, 'Please provide at least one purpose'] })
  purpose: string[];
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
