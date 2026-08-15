import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';

const UPLOAD_DIRECTORY = join(process.cwd(), 'uploads');

function ensureUploadDirectoryExists(uploadDirectory: string) {
  if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
  }
}
ensureUploadDirectoryExists(UPLOAD_DIRECTORY);

// Ported from config/uploadImage/imageupload.js's createImageUploadRoute() factory.
// Unused in the original app (never called/mounted) and unused here —
// LocalUploadModule is not imported by AppModule. The original took an arbitrary
// upload directory per call; here it's fixed to `uploads/` since Nest controllers
// aren't parameterized the same way.
@Controller('local-upload')
export class LocalUploadController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOAD_DIRECTORY,
        filename: (req, file, cb) => {
          const sanitizedFilename = basename(file.originalname, extname(file.originalname))
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
          cb(null, `${sanitizedFilename}_${Date.now()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extnameValid = filetypes.test(extname(file.originalname).toLowerCase());

        if (mimetype && extnameValid) {
          return cb(null, true);
        }
        cb(
          new BadRequestException(
            'File upload only supports the following filetypes - jpeg, jpg, png',
          ),
          false,
        );
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    console.log(`Image upload hit: ${file ? file.originalname : 'No file uploaded'}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      message: 'File uploaded successfully',
      filename: file.filename,
      path: `${req.protocol}://${req.get('host')}/${UPLOAD_DIRECTORY}/${file.filename}`,
    };
  }
}
