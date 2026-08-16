import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateShiftDto {
  @IsNotEmpty({ message: 'Shift name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Order is required' })
  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
