import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorPerformanceDto } from './create-vendor-performance.dto';

export class UpdateVendorPerformanceDto extends PartialType(CreateVendorPerformanceDto) {}
