import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { MaintenanceAssigneeType } from '../schemas/maintenance-request.schema';

export class AssignMaintenanceDto {
  @IsEnum(MaintenanceAssigneeType)
  @IsNotEmpty()
  assignedToType: MaintenanceAssigneeType;

  @ValidateIf((o) => o.assignedToType === MaintenanceAssigneeType.EMPLOYEE)
  @IsString()
  @IsNotEmpty({ message: 'An employee must be selected for an employee assignment' })
  assignedToEmployee?: string;

  @ValidateIf((o) => o.assignedToType === MaintenanceAssigneeType.VENDOR)
  @IsString()
  @IsNotEmpty({ message: 'A vendor must be selected for a vendor assignment' })
  assignedToVendor?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedCost?: number;

  @IsDateString()
  @IsOptional()
  deadline?: string;
}

export class AddWorkUpdateDto {
  @IsString()
  @IsNotEmpty()
  update: string;

  @IsArray()
  @IsOptional()
  photos?: string[];
}

export class CompleteMaintenanceDto {
  @IsString()
  @IsOptional()
  update?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  actualCost?: number;

  @IsArray()
  @IsOptional()
  afterPhotos?: string[];
}

export class RejectMaintenanceDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  reason: string;
}

export class CancelMaintenanceDto {
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  reason: string;
}
