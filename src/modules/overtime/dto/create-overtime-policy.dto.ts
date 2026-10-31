import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateOvertimePolicyDto {
  @IsNotEmpty({ message: 'Policy name is required' })
  @IsString()
  policyName: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHoursPerMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOvertimeMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offDayRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  roundingMinutes?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
