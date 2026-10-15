import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { Branch, BranchSchema } from '../branch/schemas/branch.schema';
import { GymCalendarDate, GymCalendarDateSchema } from '../gym-calendar/schemas/gym-calendar.schema';
import { GymWeeklyDefault, GymWeeklyDefaultSchema } from '../gym-calendar/schemas/gym-weekly-default.schema';
import { RosterAssignment, RosterAssignmentSchema } from '../roster/schemas/roster.schema';
import { LeaveApplication, LeaveApplicationSchema } from '../leave/schemas/leave-application.schema';
import {
  AttendanceCorrection,
  AttendanceCorrectionSchema,
  AttendanceDevice,
  AttendanceDeviceSchema,
  AttendancePunch,
  AttendancePunchSchema,
  AttendanceRecord,
  AttendanceRecordSchema,
} from './schemas/attendance.schema';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { IclockController } from './iclock.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceDevice.name, schema: AttendanceDeviceSchema },
      { name: AttendancePunch.name, schema: AttendancePunchSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: AttendanceCorrection.name, schema: AttendanceCorrectionSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: GymCalendarDate.name, schema: GymCalendarDateSchema },
      { name: GymWeeklyDefault.name, schema: GymWeeklyDefaultSchema },
      { name: RosterAssignment.name, schema: RosterAssignmentSchema },
      { name: LeaveApplication.name, schema: LeaveApplicationSchema },
    ]),
  ],
  controllers: [AttendanceController, IclockController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
