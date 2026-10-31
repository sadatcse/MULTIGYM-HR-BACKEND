import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsObject, Min } from 'class-validator';

export class CreateBonusPolicyDto {
  @IsNotEmpty({ message: 'Policy name is required' })
  @IsString()
  policyName: string;

  @IsOptional()
  @IsEnum(['Festival', 'Performance', 'Attendance', 'Annual', 'Custom'])
  bonusType?: string;

  @IsOptional()
  @IsEnum(['percentage_of_basic', 'percentage_of_gross', 'fixed_amount'])
  calculationType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusRate?: number;

  @IsOptional()
  @IsString()
  applicableMonth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minServiceMonths?: number;

  @IsOptional()
  @IsEnum(['none', 'service_months'])
  proRata?: string;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  excludeProbation?: string;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  maxAbsentDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  maxLateDays?: number;

  @IsOptional()
  @IsObject()
  appliesTo?: { designations?: string[]; branches?: string[]; employeeTypes?: string[] };

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
