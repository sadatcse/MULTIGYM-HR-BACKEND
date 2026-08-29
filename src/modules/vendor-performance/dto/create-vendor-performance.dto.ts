import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateVendorPerformanceDto {
  @IsMongoId({ message: 'A valid vendor is required' })
  vendor: string;

  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  serviceQuality: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  responseTime: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  productQuality: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  pricing: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  reliability: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
