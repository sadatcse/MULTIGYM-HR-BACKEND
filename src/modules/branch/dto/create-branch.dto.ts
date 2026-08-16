import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DayScheduleDto {
  @IsOptional()
  @IsString()
  open?: string;

  @IsOptional()
  @IsString()
  close?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class OperatingHoursDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  saturday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  sunday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  monday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  tuesday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  wednesday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  thursday?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  friday?: DayScheduleDto;
}

export class CreateBranchDto {
  @IsNotEmpty({ message: 'Branch name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Order is required' })
  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;

  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;
}
