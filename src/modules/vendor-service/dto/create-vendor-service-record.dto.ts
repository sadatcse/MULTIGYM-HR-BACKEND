import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVendorServiceRecordDto {
  @IsMongoId({ message: 'A valid vendor is required' })
  vendor: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Service date is required' })
  serviceDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedTechnician?: string;

  @IsOptional()
  @IsString()
  serviceRequestRef?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'in-progress', 'completed', 'cancelled'])
  completionStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceCost?: number;

  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;

  @IsOptional()
  @IsMongoId()
  maintenanceContract?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPaymentAmount?: number;

  @IsOptional()
  @IsString()
  initialPaymentMethod?: string;

  @IsOptional()
  @IsString()
  initialPaymentReference?: string;

  @IsOptional()
  @IsString()
  initialPaymentNote?: string;
}
