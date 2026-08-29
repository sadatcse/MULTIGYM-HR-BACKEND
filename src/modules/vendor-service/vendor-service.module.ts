import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorServiceRecordService } from './vendor-service.service';
import { VendorServiceRecordController } from './vendor-service.controller';
import { VendorServiceRecord, VendorServiceRecordSchema } from './schemas/vendor-service-record.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorServiceRecord.name, schema: VendorServiceRecordSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [VendorServiceRecordController],
  providers: [VendorServiceRecordService],
  exports: [VendorServiceRecordService],
})
export class VendorServiceModule {}
