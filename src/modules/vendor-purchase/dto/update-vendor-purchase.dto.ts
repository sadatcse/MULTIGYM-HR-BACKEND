import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorPurchaseDto } from './create-vendor-purchase.dto';

export class UpdateVendorPurchaseDto extends PartialType(CreateVendorPurchaseDto) {}
