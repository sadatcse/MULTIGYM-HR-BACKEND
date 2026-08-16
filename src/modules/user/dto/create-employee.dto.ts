import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AddressDto {
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

export class EmergencyContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;
}

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide a name' })
  name: string;

  @IsEmail({}, { message: 'Please provide an email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Please provide a password' })
  password: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['Male', 'Female', 'Other'])
  gender?: string;

  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  nidPassport?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  presentAddress?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  jobPosition?: string;

  @IsOptional()
  @IsIn(['Full-time', 'Part-time', 'Contract'])
  employeeType?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsIn(['active', 'probation', 'resigned', 'terminated', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  resignationDate?: string;

  @IsOptional()
  @IsString()
  lastWorkingDate?: string;
}
