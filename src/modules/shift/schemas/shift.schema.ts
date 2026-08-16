import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShiftDocument = Shift & Document;

@Schema({ timestamps: true })
export class Shift {
  @Prop({ required: [true, 'Shift name is required'], trim: true, unique: true })
  name: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ trim: true, default: '09:00' })
  startTime: string;

  @Prop({ trim: true, default: '17:00' })
  endTime: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);

ShiftSchema.index({ name: 1 }, { unique: true });
ShiftSchema.index({ order: 1 }, { unique: true });
