import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAssetTypeDto {
  @IsNotEmpty({ message: 'Asset type name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsString()
  category: string;

  @IsOptional()
  @IsEnum(['individual', 'inventory'])
  trackingType?: string;

  @IsOptional()
  @IsBoolean()
  returnable?: boolean;

  @IsNotEmpty({ message: 'Order is required' })
  @IsNumber()
  @Min(1, { message: 'Order must be at least 1' })
  order: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  replacementIntervalMonths?: number;

  @IsOptional()
  @IsBoolean()
  requiresSerialNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresSize?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCondition?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresEmployeeAssignment?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBranch?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDepartment?: boolean;

  @IsOptional()
  @IsBoolean()
  quantityBased?: boolean;

  @IsOptional()
  @IsBoolean()
  individualBased?: boolean;
}
