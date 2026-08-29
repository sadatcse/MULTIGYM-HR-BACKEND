import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorPerformanceService } from './vendor-performance.service';
import { VendorPerformanceController } from './vendor-performance.controller';
import { VendorPerformance, VendorPerformanceSchema } from './schemas/vendor-performance.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorPerformance.name, schema: VendorPerformanceSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [VendorPerformanceController],
  providers: [VendorPerformanceService],
  exports: [VendorPerformanceService],
})
export class VendorPerformanceModule {}
