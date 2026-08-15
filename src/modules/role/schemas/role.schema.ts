import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: [true, 'Role name is required'], trim: true, unique: true })
  name: string;

  @Prop({ required: [true, 'Order is required'], unique: true, type: Number })
  order: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ order: 1 }, { unique: true });
