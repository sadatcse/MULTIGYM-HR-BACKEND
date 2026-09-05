import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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

export class PurchaseItemInputDto {
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
  @ValidateNested()
  @Type(() => PurchaseWarrantyInputDto)
  warranty?: PurchaseWarrantyInputDto;
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

  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

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

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product item is required' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items: PurchaseItemInputDto[];
}
