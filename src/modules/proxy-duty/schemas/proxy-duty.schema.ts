import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const ProxyDutySchema = SchemaFactory.createForClass(ProxyDuty);
ProxyDutySchema.index({ dutyDate: 1 });
