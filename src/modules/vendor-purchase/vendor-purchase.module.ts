import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorPurchaseService } from './vendor-purchase.service';
import { VendorPurchaseController } from './vendor-purchase.controller';
import { VendorPurchase, VendorPurchaseSchema } from './schemas/vendor-purchase.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorPurchase.name, schema: VendorPurchaseSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [VendorPurchaseController],
  providers: [VendorPurchaseService],
  exports: [VendorPurchaseService],
})
export class VendorPurchaseModule {}
