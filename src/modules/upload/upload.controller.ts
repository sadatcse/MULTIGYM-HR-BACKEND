import { BadRequestException, Controller, HttpStatus, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|webp/;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_DOCUMENT_TYPES = /pdf|doc|docx|xls|xlsx/;
const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

// Whitelisted upload destinations — never take the S3 folder straight from
// client input, so a caller can't control the object key path.
const ALLOWED_IMAGE_FOLDERS = ['employees', 'logos'];
const DEFAULT_IMAGE_FOLDER = 'employees';
const ALLOWED_DOCUMENT_FOLDERS = ['vendor-documents'];
const DEFAULT_DOCUMENT_FOLDER = 'vendor-documents';

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

    const targetFolder = ALLOWED_IMAGE_FOLDERS.includes(folder || '') ? (folder as string) : DEFAULT_IMAGE_FOLDER;
    const url = await this.s3Service.uploadImage(file, targetFolder);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Image uploaded successfully',
      data: { url },
    };
  }

  @Post('document')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const extValid = ALLOWED_DOCUMENT_TYPES.test(extname(file.originalname).toLowerCase());
        const mimeValid = ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype);
        if (extValid && mimeValid) return cb(null, true);
        cb(new BadRequestException('Only PDF, DOC, DOCX, XLS, or XLSX files are allowed'), false);
      },
      limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
    }),
  )
  async uploadDocument(@UploadedFile() file: Express.Multer.File, @Query('folder') folder?: string) {
    if (!file) {
      throw new BadRequestException('No document file provided');
    }

    const targetFolder = ALLOWED_DOCUMENT_FOLDERS.includes(folder || '') ? (folder as string) : DEFAULT_DOCUMENT_FOLDER;
    const url = await this.s3Service.uploadDocument(file, targetFolder);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Document uploaded successfully',
      data: { url, fileName: file.originalname },
    };
  }
}
