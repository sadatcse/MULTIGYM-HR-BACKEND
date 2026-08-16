import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateDateOverrideDto {
  @IsOptional()
  @IsString()
  branchId?: string; // 'global' or branch _id

  @IsNotEmpty({ message: 'Date string is required' })
  @IsString()
  dateStr: string; // e.g. "2026-02-21"

  @IsNotEmpty({ message: 'Year is required' })
  @IsNumber()
  @Min(2026)
  @Max(2032)
  year: number;

  @IsNotEmpty({ message: 'Month is required' })
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNotEmpty({ message: 'Day is required' })
  @IsNumber()
  @Min(1)
  @Max(31)
  day: number;

  @IsNotEmpty({ message: 'Day name is required' })
  @IsString()
  dayName: string;

  @IsNotEmpty({ message: 'Gym status is required' })
  @IsEnum(['open', 'closed'], { message: 'Gym status must be open or closed' })
  gymStatus: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsNotEmpty({ message: 'Day type is required' })
  @IsEnum(
    [
      'working_day',
      'weekly_off',
      'public_holiday',
      'special_holiday',
      'company_holiday',
      'emergency_closure',
    ],
    { message: 'Invalid day type' },
  )
  dayType: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPaidHoliday?: boolean;

  @IsOptional()
  @IsBoolean()
  isSalaryApplicable?: boolean;
}
