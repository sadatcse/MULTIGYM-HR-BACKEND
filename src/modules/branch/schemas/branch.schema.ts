import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ name: 1 }, { unique: true });
BranchSchema.index({ order: 1 }, { unique: true });
