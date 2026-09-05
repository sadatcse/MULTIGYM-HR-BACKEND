import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MaintenanceCategory, MaintenancePriority } from '../schemas/maintenance-request.schema';

// Deliberately exposes only what an employee is allowed to set. There is no
// assignedTo*/estimatedCost/status/completedDate field here at all, so
// there's nothing for a client to tamper with — those belong exclusively to
// the management-side DTOs below and are set through their own endpoints.
export class CreateMaintenanceRequestDto {
  @IsEnum(MaintenanceCategory)
  @IsNotEmpty()
  category: MaintenanceCategory;

  @IsString()
  @IsNotEmpty()
  issue: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MaintenancePriority)
  @IsOptional()
  priority?: MaintenancePriority;

  @IsArray()
  @IsOptional()
  photos?: string[];
}
