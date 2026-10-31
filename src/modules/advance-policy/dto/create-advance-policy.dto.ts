import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateAdvancePolicyDto {
  @IsNotEmpty({ message: 'Policy name is required' })
  @IsString()
  policyName: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAdvancePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAdvanceCount?: number;

  @IsOptional()
  @IsString()
  defaultDeductionType?: string;

  @IsOptional()
  @IsNumber()
  minServiceMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxInstallments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  allowConcurrent?: string;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  allowDuringProbation?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
