import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ASSET_CONDITIONS, DISPOSAL_TYPES, MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from '../schemas/gym-asset-common';

export class FileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsUrl({ require_protocol: true }, { message: 'Each file needs a valid URL' })
  url: string;
}

// Optional client key: a retried save with the same key returns the first result.
class Idempotent {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;
}

// ---------------------------------------------------------------- locations / places / categories
export class CreateLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'Location name is required' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsIn(['branch', 'warehouse', 'head_office', 'other'], { message: 'Pick a valid location type' })
  type?: string;

  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) contactPerson?: string;

  @IsOptional()
  @ValidateIf((o) => o.contactNumber !== '')
  @Matches(/^\+?[0-9][0-9\s-]{5,19}$/, { message: 'Contact number must be 6–20 digits (spaces, dashes and a leading + allowed)' })
  contactNumber?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}

export class CreatePlaceDto {
  @IsMongoId({ message: 'Pick the location this place belongs to' })
  location: string;

  @IsString()
  @IsNotEmpty({ message: 'Place name is required' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
export class UpdatePlaceDto extends PartialType(CreatePlaceDto) {}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Depreciation must be a number' })
  @Min(0)
  @Max(100, { message: 'Depreciation can be at most 100% a year' })
  depreciationRate?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

// ---------------------------------------------------------------- asset
export class CreateGymAssetDto extends Idempotent {
  @IsString()
  @IsNotEmpty({ message: 'Asset name is required' })
  @MaxLength(120)
  name: string;

  @IsMongoId({ message: 'Pick a category' })
  category: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: 'Up to 8 images per asset' })
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  images?: FileDto[];

  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(80) modelNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) specification?: string;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(100000)
  quantity: number;

  @IsOptional() @IsString() @MaxLength(20) unit?: string;

  @IsOptional()
  @ValidateIf((o) => o.purchaseDate !== '')
  @IsDateString({}, { message: 'Purchase date is not a valid date' })
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Purchase price must be a number' })
  @Min(0, { message: "Purchase price can't be negative" })
  unitPrice?: number;

  @IsOptional() @IsString() @MaxLength(120) supplier?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number;

  @IsOptional()
  @ValidateIf((o) => o.warrantyExpiry !== '')
  @IsDateString({}, { message: 'Warranty expiry is not a valid date' })
  warrantyExpiry?: string;

  @IsMongoId({ message: 'Pick the location' })
  location: string;

  @IsMongoId({ message: 'Pick the place inside the location' })
  place: string;

  @IsOptional() @IsString() @MaxLength(80) responsiblePerson?: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS.filter((c) => c !== 'disposed'), { message: 'Pick a valid condition (disposal has its own form)' })
  condition?: string;

  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class UpdateGymAssetDto extends PartialType(CreateGymAssetDto) {}

// ---------------------------------------------------------------- operations
export class CreateTransferDto extends Idempotent {
  @IsMongoId({ message: 'Pick the asset to transfer' })
  asset: string;

  // Defaults to the whole line; less than that moves part of a batch.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Transfer at least 1' })
  quantity?: number;

  @IsMongoId({ message: 'Pick the destination location' })
  toLocation: string;

  @IsMongoId({ message: 'Pick the destination place' })
  toPlace: string;

  @IsDateString({}, { message: 'Transfer date is required' })
  transferDate: string;

  @IsString()
  @IsNotEmpty({ message: 'Give a reason for the transfer' })
  @MaxLength(300)
  reason: string;

  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class CreateMaintenanceDto extends Idempotent {
  @IsMongoId({ message: 'Pick the asset' })
  asset: string;

  @IsString()
  @IsNotEmpty({ message: 'Describe the problem' })
  @MaxLength(1000)
  problem: string;

  @IsIn(MAINTENANCE_TYPES, { message: 'Pick a maintenance type' })
  maintenanceType: string;

  @IsOptional() @IsString() @MaxLength(120) serviceProvider?: string;
  @IsOptional() @IsString() @MaxLength(80) technician?: string;

  @IsDateString({}, { message: 'Maintenance date is required' })
  maintenanceDate: string;

  @IsOptional()
  @IsIn(['pending', 'in_progress'], { message: 'A new record starts as Pending or In progress' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Cost can't be negative" })
  cost?: number;

  @IsOptional()
  @ValidateIf((o) => o.nextMaintenanceDate !== '')
  @IsDateString({}, { message: 'Next maintenance date is not a valid date' })
  nextMaintenanceDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  attachments?: FileDto[];

  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class UpdateMaintenanceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(1000) problem?: string;
  @IsOptional() @IsIn(MAINTENANCE_TYPES) maintenanceType?: string;
  @IsOptional() @IsString() @MaxLength(120) serviceProvider?: string;
  @IsOptional() @IsString() @MaxLength(80) technician?: string;
  @IsOptional() @IsDateString() maintenanceDate?: string;

  @IsOptional()
  @IsIn(MAINTENANCE_STATUSES, { message: 'Pick a valid status' })
  status?: string;

  @IsOptional()
  @ValidateIf((o) => o.completionDate !== '')
  @IsDateString({}, { message: 'Completion date is not a valid date' })
  completionDate?: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS.filter((c) => !['disposed', 'under_maintenance'].includes(c)), { message: 'Pick the condition after maintenance' })
  conditionAfter?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Cost can't be negative" })
  cost?: number;

  @IsOptional()
  @ValidateIf((o) => o.nextMaintenanceDate !== '')
  @IsDateString({}, { message: 'Next maintenance date is not a valid date' })
  nextMaintenanceDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  attachments?: FileDto[];

  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class CreateDisposalDto extends Idempotent {
  @IsMongoId({ message: 'Pick the asset to dispose' })
  asset: string;

  @IsDateString({}, { message: 'Disposal date is required' })
  disposalDate: string;

  @IsString()
  @IsNotEmpty({ message: 'Give a reason for the disposal' })
  @MaxLength(300)
  reason: string;

  @IsIn(DISPOSAL_TYPES, { message: 'Pick a disposal type' })
  disposalType: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Disposal value can't be negative" })
  disposalValue?: number;

  @IsString()
  @IsNotEmpty({ message: 'Who approved this disposal?' })
  @MaxLength(80)
  approvedByName: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  attachments?: FileDto[];

  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class UpdateDisposalDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  attachments?: FileDto[];

  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}
