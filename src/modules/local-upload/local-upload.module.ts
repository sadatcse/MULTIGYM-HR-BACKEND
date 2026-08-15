import { Module } from '@nestjs/common';
import { LocalUploadController } from './local-upload.controller';

// Not imported by AppModule — mirrors the original, where config/uploadImage/imageupload.js
// existed but its router factory was never called from server.js.
@Module({
  controllers: [LocalUploadController],
})
export class LocalUploadModule {}
