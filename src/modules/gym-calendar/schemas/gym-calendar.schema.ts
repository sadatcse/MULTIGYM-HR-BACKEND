import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GymCalendarDateDocument = GymCalendarDate & Document;

@Schema({ timestamps: true })
export class GymCalendarDate {
  @Prop({ required: true, trim: true, default: 'global' })
  branchId: string; // 'global' or specific branch _id

  @Prop({ required: true, index: true, trim: true })
  dateStr: string; // Format: "YYYY-MM-DD" e.g. "2026-02-21"

  @Prop({ required: true, type: Number, index: true })
  year: number; // e.g. 2026

  @Prop({ required: true, type: Number, index: true })
  month: number; // 1 to 12

  @Prop({ required: true, type: Number })
  day: number; // 1 to 31

  @Prop({ required: true, trim: true })
  dayName: string; // e.g. "Saturday"

  @Prop({ required: true, enum: ['open', 'closed'], default: 'open' })
  gymStatus: string; // 'open' | 'closed'

  @Prop({ trim: true, default: '' })
  openingTime: string; // e.g. "07:00"

  @Prop({ trim: true, default: '' })
  closingTime: string; // e.g. "23:00"

  @Prop({
    required: true,
    enum: [
      'working_day',
      'weekly_off',
      'public_holiday',
      'special_holiday',
      'company_holiday',
      'emergency_closure',
    ],
    default: 'working_day',
  })
  dayType: string;

  @Prop({ trim: true, default: '' })
  title: string; // Holiday or Event short name

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, type: Boolean, default: true })
  isPaidHoliday: boolean;

  @Prop({ required: true, type: Boolean, default: true })
  isSalaryApplicable: boolean;
}

export const GymCalendarDateSchema = SchemaFactory.createForClass(GymCalendarDate);

GymCalendarDateSchema.index({ dateStr: 1, branchId: 1 }, { unique: true });
GymCalendarDateSchema.index({ year: 1, month: 1, branchId: 1 });
