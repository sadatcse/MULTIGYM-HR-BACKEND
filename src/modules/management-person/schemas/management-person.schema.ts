import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Employee } from '../../user/schemas/employee.schema';

export type ManagementPersonDocument = ManagementPerson & Document;

@Schema({ timestamps: true })
export class ManagementPerson {
  @Prop({ required: true, trim: true })
  title: string; // e.g. 'MD Sir', 'Director Sir', 'Chairman', 'CEO', 'Management', 'Admin & HR'

  @Prop({ trim: true, uppercase: true })
  code: string; // e.g. 'MD_SIR', 'DIRECTOR_SIR', 'CHAIRMAN', 'CEO', 'MANAGEMENT', 'ADMIN_HR'

  @Prop({ trim: true })
  designation?: string; // e.g. 'Managing Director', 'Executive Director', 'Head of Operations'

  @Prop({ type: Types.ObjectId, ref: Employee.name, default: null })
  employee?: Types.ObjectId; // Reference to assigned employee/user

  @Prop({ trim: true })
  employeeName?: string; // Cached or custom person name (e.g. 'Engr. Mohammad Sadat')

  @Prop({ trim: true })
  employeeId?: string; // Employee ID code (e.g. 'EMP-001')

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ trim: true })
  department?: string;

  @Prop({ trim: true })
  branch?: string;

  @Prop({ trim: true })
  avatar?: string; // Photo URL

  @Prop({ type: Number, default: 1 })
  priorityOrder: number; // 1 for highest authority (MD Sir), 2 for Director Sir, etc.

  @Prop({ type: Boolean, default: true })
  canIssueInstructions: boolean;

  @Prop({ type: Boolean, default: true })
  canApproveTasks: boolean;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId;
}

export const ManagementPersonSchema = SchemaFactory.createForClass(ManagementPerson);

// Indexes
ManagementPersonSchema.index({ title: 1 });
ManagementPersonSchema.index({ code: 1 });
ManagementPersonSchema.index({ status: 1 });
ManagementPersonSchema.index({ priorityOrder: 1 });
ManagementPersonSchema.index({ employee: 1 });
