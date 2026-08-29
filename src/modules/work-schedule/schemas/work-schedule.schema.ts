import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkScheduleDocument = WorkSchedule & Document;

@Schema({ timestamps: true, collection: 'workschedules' })
export class WorkSchedule {
  @Prop({ required: [true, 'Schedule name is required'], trim: true, unique: true })
  scheduleName: string;

  @Prop({ required: true, trim: true, default: 'General Day Shift' })
  shiftType: string;

  @Prop({ trim: true, default: '09:00' })
  startTime: string;

  @Prop({ trim: true, default: '17:00' })
  endTime: string;

  @Prop({ required: true, type: Number, default: 8 })
  workHoursPerDay: number;

  @Prop({ trim: true, default: '' })
  workHoursFormatted: string;

  @Prop({ type: Boolean, default: false })
  isMultiSlot: boolean;

  @Prop({
    type: [
      {
        slotName: { type: String, default: '' },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        durationMinutes: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  timeSlots: Array<{
    slotName?: string;
    startTime: string;
    endTime: string;
    durationMinutes?: number;
  }>;

  @Prop({ required: true, type: Number, default: 5 })
  workDaysPerWeek: number;

  @Prop({ required: true, type: Number, default: 15 })
  lateToleranceMinutes: number;

  @Prop({ required: true, type: Number, default: 4 })
  halfDayHours: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ type: [String], default: [] })
  assignedEmployees: string[];

  @Prop({ required: true, type: Number, default: 1 })
  order: number;
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);
WorkScheduleSchema.index({ scheduleName: 1 }, { unique: true });
WorkScheduleSchema.index({ order: 1 });
