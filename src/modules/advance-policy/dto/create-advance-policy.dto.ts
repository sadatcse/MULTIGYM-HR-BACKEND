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
  @IsEnum(['active', 'inactive'])
  status?: string;
}
