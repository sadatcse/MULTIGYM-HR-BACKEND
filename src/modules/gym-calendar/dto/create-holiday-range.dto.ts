import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class CreateHolidayRangeDto {
  @IsOptional()
  @IsString()
  branchId?: string; // 'global' or branch _id

  @IsNotEmpty({ message: 'Start Date is required' })
  @IsString()
  startDate: string; // "YYYY-MM-DD"

  @IsNotEmpty({ message: 'End Date is required' })
  @IsString()
  endDate: string; // "YYYY-MM-DD"

  @IsNotEmpty({ message: 'Holiday Title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Day Type is required' })
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

  @IsNotEmpty({ message: 'Gym Status is required' })
  @IsEnum(['open', 'closed'])
  gymStatus: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

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
