import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingDocument = Setting & Document;

@Schema({ timestamps: true })
export class Setting {
  @Prop({ default: 'Multigym HR', trim: true })
  companyName: string;

  @Prop({ default: 'Complete Enterprise HR & Payroll Management', trim: true })
  companyTagline: string;

  @Prop({ default: 'info@multigymhr.com', trim: true })
  email: string;

  @Prop({ default: '+880 1700-000000', trim: true })
  phone: string;

  @Prop({ default: 'House 12, Road 5, Dhanmondi, Dhaka 1205, Bangladesh', trim: true })
  address: string;

  @Prop({ default: 'https://multigymhr.com', trim: true })
  website: string;

  @Prop({ default: '', trim: true })
  logo: string;

  @Prop({ default: 'BIN-123456789', trim: true })
  taxNumber: string;

  // Localization & Time Zone
  @Prop({ default: 'Asia/Dhaka', trim: true })
  timeZone: string;

  @Prop({ default: 'YYYY-MM-DD', trim: true })
  dateFormat: string;

  @Prop({ default: '৳', trim: true })
  currencySymbol: string;

  @Prop({ default: 'English', trim: true })
  language: string;

  // Print Header & Footer Inches Settings
  @Prop({ default: 'yes', enum: ['yes', 'no'] })
  enablePrintHeader: string;

  @Prop({ default: 'yes', enum: ['yes', 'no'] })
  enablePrintFooter: string;

  @Prop({ default: 1.0, type: Number })
  printHeaderInch: number;

  @Prop({ default: 0.75, type: Number })
  printFooterInch: number;

  @Prop({ default: 'MULTIGYM HR MANAGEMENT SYSTEM', trim: true })
  printHeaderText: string;

  @Prop({ default: 'This is a computer-generated document. No signature required.', trim: true })
  printFooterText: string;

  // HR Policy Defaults
  @Prop({ default: 3, type: Number })
  probationMonths: number;

  @Prop({ default: 5, type: Number })
  workingDaysPerWeek: number;

  @Prop({ default: 8, type: Number })
  dailyWorkHours: number;

  @Prop({ default: 1.5, type: Number })
  overtimeRate: number;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
