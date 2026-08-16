import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsNotEmpty({ message: 'Leave type name is required' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  isPaid?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  daysAllowed?: number;

  @IsOptional()
  @IsEnum(['yes', 'no'])
  carryForward?: string;

  @IsOptional()
  @IsEnum(['All', 'Male', 'Female'])
  applicableFor?: string;

  @IsOptional()
  @IsNumber()
  policyYear?: number;

  @IsOptional()
  @IsNumber()
  order?: number;
}
