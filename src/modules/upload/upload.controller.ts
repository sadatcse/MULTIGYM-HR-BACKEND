import { BadRequestException, Controller, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|webp/;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const url = await this.s3Service.uploadImage(file, 'employees');

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Image uploaded successfully',
      data: { url },
    };
  }
}
