import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateProxyDutyDto {
  @IsNotEmpty({ message: 'Original employee name is required' })
  @IsString()
  originalEmployeeName: string;

  @IsOptional()
  @IsString()
  originalEmployeeId?: string;

  @IsNotEmpty({ message: 'Proxy employee name is required' })
  @IsString()
  proxyEmployeeName: string;

  @IsOptional()
  @IsString()
  proxyEmployeeId?: string;

  @IsNotEmpty({ message: 'Duty date is required' })
  @IsString()
  dutyDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proxyPayAmount?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'completed'])
  status?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
