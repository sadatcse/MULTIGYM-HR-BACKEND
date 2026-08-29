import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorContractService } from './vendor-contract.service';
import { VendorContractController } from './vendor-contract.controller';
import { VendorContract, VendorContractSchema } from './schemas/vendor-contract.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorContract.name, schema: VendorContractSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [VendorContractController],
  providers: [VendorContractService],
  exports: [VendorContractService],
})
export class VendorContractModule {}
