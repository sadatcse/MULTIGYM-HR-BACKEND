import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class EmployeeDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

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
  @IsIn(['active', 'probation', 'suspended', 'resigned', 'terminated', 'inactive'])
  status?: string;

  @IsArray()
  @IsOptional()
  branches?: string[];

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  workSchedule?: string;

  @IsOptional()
  @IsString()
  dutyInTime?: string;

  @IsOptional()
  @IsString()
  dutyOutTime?: string;

  @IsOptional()
  @IsArray()
  branchSchedules?: Array<{
    branch: string;
    shift?: string;
    workSchedule?: string;
    inTime?: string;
    outTime?: string;
    days?: string[];
    notes?: string;
  }>;

  @IsOptional()
  weeklyRoster?: any;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  resignationDate?: string;

  @IsOptional()
  @IsString()
  lastWorkingDate?: string;

  @IsOptional()
  @IsString()
  reportingAuthority?: string;

  @IsOptional()
  @IsString()
  reportingAuthorityName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossSalary?: number;

  @IsOptional()
  @IsString()
  deviceUserId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeDocumentDto)
  documents?: EmployeeDocumentDto[];

  // Set by HR when an edit should NOT be auto-recorded in employee history
  // (e.g. correcting a typo in the designation rather than a real promotion).
  @IsOptional()
  skipHistory?: boolean;
}
