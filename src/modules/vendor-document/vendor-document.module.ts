import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorDocumentService } from './vendor-document.service';
import { VendorDocumentController } from './vendor-document.controller';
import { VendorAttachment, VendorAttachmentSchema } from './schemas/vendor-attachment.schema';
import { Vendor, VendorSchema } from '../vendor/schemas/vendor.schema';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorAttachment.name, schema: VendorAttachmentSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    UploadModule,
  ],
  controllers: [VendorDocumentController],
  providers: [VendorDocumentService],
  exports: [VendorDocumentService],
})
export class VendorDocumentModule {}
