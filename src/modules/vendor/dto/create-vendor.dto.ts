import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class VendorAddressInputDto {
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

class VendorContactPersonInputDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class VendorBusinessInfoInputDto {
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  businessType?: string;
}

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor/company name' })
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VendorAddressInputDto)
  address?: VendorAddressInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VendorContactPersonInputDto)
  contactPerson1?: VendorContactPersonInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VendorContactPersonInputDto)
  contactPerson2?: VendorContactPersonInputDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phones?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VendorBusinessInfoInputDto)
  businessInfo?: VendorBusinessInfoInputDto;

  @IsOptional()
  @IsString()
  taxVatNumber?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
