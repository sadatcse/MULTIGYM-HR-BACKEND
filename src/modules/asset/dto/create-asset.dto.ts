import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAssetDto {
  @IsMongoId({ message: 'A valid asset type is required' })
  assetType: string;

  @IsString()
  @IsNotEmpty({ message: 'Asset code is required' })
  assetCode: string;

  @IsOptional()
  @IsEnum(['simple', 'variable'])
  productType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  returnable?: boolean;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantityTotal?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsEnum(['available', 'assigned', 'damaged', 'lost', 'repair', 'disposed', 'low_stock'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockThreshold?: number;

  @IsOptional()
  sizeVariants?: Array<{
    size: string;
    variantName?: string;
    quantityTotal: number;
    minStockThreshold?: number;
  }>;

  @IsOptional()
  attributes?: Array<{
    name: string;
    value: string;
  }>;
}
