import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateOvertimeRecordDto {
  @IsNotEmpty({ message: 'Employee name is required' })
  @IsString()
  employeeName: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsNotEmpty({ message: 'Record date is required' })
  @IsString()
  recordDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeMinutes?: number;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
