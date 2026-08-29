import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorContractDto } from './create-vendor-contract.dto';

export class UpdateVendorContractDto extends PartialType(CreateVendorContractDto) {}
