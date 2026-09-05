import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// One recipient in a bulk issue — size/quantity are optional per-person
// overrides (e.g. one staff member needs Medium, another needs Large from
// the same batch); when omitted, the batch-level `size`/`quantity` on
// BulkIssueAssetDto is used as the fallback for that person.
export class BulkIssueEmployeeEntryDto {
  @IsMongoId({ message: 'Each employee must be a valid ID' })
  employee: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class BulkIssueAssetDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one employee must be selected' })
  @ValidateNested({ each: true })
  @Type(() => BulkIssueEmployeeEntryDto)
  employees: BulkIssueEmployeeEntryDto[];

  @IsMongoId({ message: 'A valid asset ID is required' })
  @IsNotEmpty({ message: 'Asset is required' })
  asset: string;

  // Batch-level default size/quantity — used for any entry above that
  // doesn't specify its own.
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNotEmpty({ message: 'Issue date is required' })
  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsString()
  issueCondition?: string;

  @IsOptional()
  @IsString()
  issuedBy?: string;

  @IsOptional()
  @IsString()
  issueNotes?: string;
}
