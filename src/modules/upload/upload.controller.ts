import { BadRequestException, Controller, HttpStatus, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|webp/;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Whitelisted upload destinations — never take the S3 folder straight from
// client input, so a caller can't control the object key path.
const ALLOWED_FOLDERS = ['employees', 'logos'];
const DEFAULT_FOLDER = 'employees';

@Controller('upload')
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const extValid = ALLOWED_IMAGE_TYPES.test(extname(file.originalname).toLowerCase());
        const mimeValid = ALLOWED_IMAGE_TYPES.test(file.mimetype);
        if (extValid && mimeValid) return cb(null, true);
        cb(new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'), false);
      },
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Query('folder') folder?: string) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const targetFolder = ALLOWED_FOLDERS.includes(folder || '') ? (folder as string) : DEFAULT_FOLDER;
    const url = await this.s3Service.uploadImage(file, targetFolder);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Image uploaded successfully',
      data: { url },
    };
  }
}
