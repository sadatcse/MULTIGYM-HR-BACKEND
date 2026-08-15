import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor name' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor description' })
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the contact person' })
  contactPerson: string;

  @IsString()
  @IsNotEmpty({ message: "Please provide the contact person's mobile number" })
  contactPersonMobile: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor phone number' })
  vendorPhone: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor email' })
  vendorEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the vendor address' })
  vendorAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the city' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide the trade license' })
  tradeLicense: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Please provide at least one purpose' })
  @IsString({ each: true })
  purpose: string[];
}
