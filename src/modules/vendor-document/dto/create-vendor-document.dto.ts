import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVendorDocumentDto {
  @IsMongoId({ message: 'A valid vendor is required' })
  vendor: string;

  @IsOptional()
  @IsEnum(['vendor', 'purchase', 'service', 'contract'])
  relatedType?: string;

  @IsOptional()
  @IsMongoId()
  relatedId?: string;

  @IsEnum([
    'contract',
    'invoice',
    'purchase-order',
    'warranty-certificate',
    'service-report',
    'vendor-agreement',
    'quotation',
    'other',
  ])
  documentType: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;
}
