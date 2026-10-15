import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type HrConfigDocument = HydratedDocument<HrConfig>;

// Single-document collection holding the HR workflow wiring that would
// otherwise be hardcoded: which roles act at each approval stage, which roles
// are limited to their own branch / own records, and the attendance/payroll
// calculation knobs. Role names are compared normalized (uppercase, letters
// and digits only), so "HR Admin", "HR-ADMIN" and "hr admin" all match.
@Schema({ timestamps: true, collection: 'hr_configs' })
export class HrConfig {
  @Prop({ default: 'default', unique: true })
  key: string;

  @Prop({ type: [String], default: [] })
  branchScopedRoles: string[];

  @Prop({ type: [String], default: [] })
  selfOnlyRoles: string[];

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  leaveStages: { branch: string[]; hr: string[]; director: string[] };

  @Prop({ type: Boolean, default: false })
  leaveSkipBranchStage: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  requisitionStages: { admin: string[]; management: string[]; purchase: string[] };

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  attendance: {
    defaultInTime: string;
    defaultOutTime: string;
    graceMinutes: number;
    earlyLeaveToleranceMinutes: number;
    halfDayMinutes: number;
    overtimeAfterMinutes: number;
    minPunchGapMinutes: number;
    timezoneOffsetMinutes: number;
  };

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  payroll: {
    perDayBasis: 'gross' | 'basic';
    daysBasis: 'calendar' | 'fixed30';
    standardHoursPerDay: number;
    currency: string;
  };

  // Shared secret for the JSON punch push endpoint used by a local sync
  // agent (devices that cannot reach the server through ADMS push).
  @Prop({ default: '' })
  deviceApiKey: string;
}

export const HrConfigSchema = SchemaFactory.createForClass(HrConfig);

export const DEFAULT_HR_CONFIG = {
  key: 'default',
  branchScopedRoles: ['BRANCH IN-CHARGE', 'FLOOR IN-CHARGE', 'IN-CHARGE', 'BRANCH MANAGER', 'FRONT DESK'],
  selfOnlyRoles: ['USER', 'STAFF', 'EMPLOYEE'],
  leaveStages: {
    branch: ['BRANCH IN-CHARGE', 'FLOOR IN-CHARGE', 'IN-CHARGE', 'BRANCH MANAGER'],
    hr: ['HR', 'HR ADMIN', 'HR MANAGER', 'MANAGER', 'MANAGER (ADMIN & HR)', 'ADMIN', 'GENERAL MANAGER'],
    director: ['DIRECTOR', 'MD', 'MANAGING DIRECTOR'],
  },
  leaveSkipBranchStage: false,
  requisitionStages: {
    admin: ['ADMIN', 'HR ADMIN', 'MANAGER', 'MANAGER (ADMIN & HR)', 'HR MANAGER', 'GENERAL MANAGER'],
    management: ['DIRECTOR', 'MD', 'MANAGING DIRECTOR'],
    purchase: ['ADMIN', 'HR ADMIN', 'MANAGER', 'MANAGER (ADMIN & HR)', 'GENERAL MANAGER'],
  },
  attendance: {
    defaultInTime: '09:00',
    defaultOutTime: '17:00',
    graceMinutes: 15,
    earlyLeaveToleranceMinutes: 15,
    halfDayMinutes: 240,
    overtimeAfterMinutes: 30,
    minPunchGapMinutes: 5,
    timezoneOffsetMinutes: 360,
  },
  payroll: {
    perDayBasis: 'gross' as 'gross' | 'basic',
    daysBasis: 'calendar' as 'calendar' | 'fixed30',
    standardHoursPerDay: 8,
    currency: '৳',
  },
};
