import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorServiceRecordDto } from './create-vendor-service-record.dto';

export class UpdateVendorServiceRecordDto extends PartialType(CreateVendorServiceRecordDto) {}
