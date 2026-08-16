import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyTagline?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  enablePrintHeader?: string;

  @IsOptional()
  @IsString()
  enablePrintFooter?: string;

  @IsOptional()
  @IsNumber()
  printHeaderInch?: number;

  @IsOptional()
  @IsNumber()
  printFooterInch?: number;

  @IsOptional()
  @IsString()
  printHeaderText?: string;

  @IsOptional()
  @IsString()
  printFooterText?: string;

  @IsOptional()
  @IsNumber()
  probationMonths?: number;

  @IsOptional()
  @IsNumber()
  workingDaysPerWeek?: number;

  @IsOptional()
  @IsNumber()
  dailyWorkHours?: number;

  @IsOptional()
  @IsNumber()
  overtimeRate?: number;
}
