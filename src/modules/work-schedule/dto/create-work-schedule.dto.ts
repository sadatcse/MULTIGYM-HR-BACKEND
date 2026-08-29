import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean, Min } from 'class-validator';

export class CreateWorkScheduleDto {
  @IsNotEmpty({ message: 'Schedule name is required' })
  @IsString()
  scheduleName: string;

  @IsOptional()
  @IsString()
  shiftType?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  workHoursPerDay?: number;

  @IsOptional()
  @IsString()
  workHoursFormatted?: string;

  @IsOptional()
  @IsBoolean()
  isMultiSlot?: boolean;

  @IsOptional()
  @IsArray()
  timeSlots?: any[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  workDaysPerWeek?: number;

  @IsOptional()
  @IsNumber()
  lateToleranceMinutes?: number;

  @IsOptional()
  @IsNumber()
  halfDayHours?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsArray()
  assignedEmployees?: string[];

  @IsOptional()
  @IsNumber()
  order?: number;
}
