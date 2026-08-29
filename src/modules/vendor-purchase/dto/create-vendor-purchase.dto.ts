import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PurchaseWarrantyInputDto {
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  durationMonths?: number;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  assetId?: string;
}

export class CreateVendorPurchaseDto {
  @IsMongoId({ message: 'A valid vendor is required' })
  vendor: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Purchase date is required' })
  purchaseDate: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  productName: string;

  @IsOptional()
  @IsString()
  productCategory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  @IsOptional()
  @IsEnum(['paid', 'partial', 'pending', 'overdue'])
  paymentStatus?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PurchaseWarrantyInputDto)
  warranty?: PurchaseWarrantyInputDto;
}
