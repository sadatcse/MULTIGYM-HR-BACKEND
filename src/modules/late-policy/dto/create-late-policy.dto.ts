import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateLatePolicyDto {
  @IsNotEmpty({ message: 'Policy name is required' })
  @IsString()
  policyName: string;

  @IsOptional()
  @IsEnum(['window', 'nearest_shift'])
  matchingMethod?: string;

  @IsOptional()
  @IsEnum(['any_punch', 'both_punches'])
  presentRule?: string;

  @IsOptional()
  @IsNumber()
  graceBeforeStart?: number;

  @IsOptional()
  @IsNumber()
  graceAfterEnd?: number;

  @IsOptional()
  @IsNumber()
  lateTolerance?: number;

  @IsOptional()
  @IsEnum(['fixed', 'per_minute', 'per_day', 'salary_wise'])
  deductionType?: string;

  @IsOptional()
  @IsNumber()
  deductionAmount?: number;

  @IsOptional()
  @IsNumber()
  maxLateAllowedPerMonth?: number;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  lateCountAsAbsent?: string;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  compensatedLate?: string;

  @IsOptional()
  @IsNumber()
  earlyExitTolerance?: number;

  @IsOptional()
  @IsNumber()
  maxEarlyExitsAllowedPerMonth?: number;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  compensatedEarlyExit?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
