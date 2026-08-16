import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: [true, 'Branch name is required'], trim: true, unique: true })
  name: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ required: [true, 'Address is required'], trim: true })
  address: string;

  @Prop({ required: [true, 'Phone number is required'], trim: true })
  phone: string;

  @Prop({ trim: true, default: '' })
  website: string;

  @Prop({ trim: true, default: '' })
  openingTime: string;

  @Prop({ trim: true, default: '' })
  closingTime: string;

  @Prop({
    type: SchemaTypes.Mixed,
    default: {
      saturday: { open: '', close: '', isClosed: false },
      sunday: { open: '', close: '', isClosed: false },
      monday: { open: '', close: '', isClosed: false },
      tuesday: { open: '', close: '', isClosed: false },
      wednesday: { open: '', close: '', isClosed: false },
      thursday: { open: '', close: '', isClosed: false },
      friday: { open: '', close: '', isClosed: false },
    },
  })
  operatingHours: any;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ name: 1 }, { unique: true });
BranchSchema.index({ order: 1 }, { unique: true });
