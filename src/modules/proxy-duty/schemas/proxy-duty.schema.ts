import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type ProxyDutyDocument = ProxyDuty & Document;

@Schema({ timestamps: true, collection: 'proxyduties' })
export class ProxyDuty {
  @Prop({ required: [true, 'Original employee name is required'], trim: true })
  originalEmployeeName: string;

  @Prop({ trim: true, default: '' })
  originalEmployeeId: string;

  @Prop({ required: [true, 'Proxy employee name is required'], trim: true })
  proxyEmployeeName: string;

  @Prop({ trim: true, default: '' })
  proxyEmployeeId: string;

  @Prop({ required: [true, 'Duty date is required'], trim: true })
  dutyDate: string;

  @Prop({ required: true, type: Number, default: 0 })
  proxyPayAmount: number;

  @Prop({ required: true, enum: ['active', 'inactive', 'completed'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  remarks: string;

  // proxy = covers someone (paid proxyPayAmount); swap = two people exchange duties.
  @Prop({ enum: ['proxy', 'swap'], default: 'proxy', index: true })
  type: string;

  // swap only: the date the original employee works in return.
  @Prop({ trim: true, default: '' })
  swapDate: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  originalEmployee: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  proxyEmployee: Types.ObjectId | null;

  @Prop({ trim: true, default: '', index: true })
  branch: string;

  @Prop({ trim: true, default: '' })
  department: string;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  createdBy: { id: string; name: string } | null;
}

export const ProxyDutySchema = SchemaFactory.createForClass(ProxyDuty);
ProxyDutySchema.index({ dutyDate: 1 });
