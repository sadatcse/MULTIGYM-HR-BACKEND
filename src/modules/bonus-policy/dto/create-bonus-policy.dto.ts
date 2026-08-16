import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

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
  @IsEnum(['active', 'inactive'])
  status?: string;
}
