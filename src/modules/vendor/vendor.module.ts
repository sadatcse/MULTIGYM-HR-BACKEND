import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { VendorService } from './vendor.service';
import { VendorController } from './vendor.controller';
import { VendorPurchaseModule } from '../vendor-purchase/vendor-purchase.module';
import { VendorServiceModule } from '../vendor-service/vendor-service.module';
import { VendorContractModule } from '../vendor-contract/vendor-contract.module';
import { VendorDocumentModule } from '../vendor-document/vendor-document.module';
import { VendorPerformanceModule } from '../vendor-performance/vendor-performance.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vendor.name, schema: VendorSchema }]),
    VendorPurchaseModule,
    VendorServiceModule,
    VendorContractModule,
    VendorDocumentModule,
    VendorPerformanceModule,
  ],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
