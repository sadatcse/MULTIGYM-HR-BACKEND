import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsArray, Min } from 'class-validator';

export class CreateWorkScheduleDto {
  @IsNotEmpty({ message: 'Schedule name is required' })
  @IsString()
  scheduleName: string;

  @IsOptional()
  @IsString()
  shiftType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  workHoursPerDay?: number;

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
