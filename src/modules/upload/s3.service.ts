import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket = process.env.AWS_STORAGE_BUCKET_NAME as string;
  private readonly publicBaseUrl = (process.env.AWS_S3_ENDPOINT_URL || '').replace(/\/+$/, '');

  private readonly client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY as string,
    },
  });

  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${uuidv4()}${extname(file.originalname).toLowerCase()}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (err) {
      this.logger.error(`S3 upload failed for key "${key}": ${(err as Error).message}`);
      throw new InternalServerErrorException('Image upload failed. Please try again.');
    }

    return `${this.publicBaseUrl}/${key}`;
  }

  // Best-effort cleanup of a previously-uploaded object (e.g. a photo being
  // replaced). Never throws — a failed delete shouldn't fail the calling
  // request, it just leaves an orphaned object for later cleanup.
  async deleteByUrl(url?: string | null): Promise<void> {
    if (!url || !this.publicBaseUrl || !url.startsWith(`${this.publicBaseUrl}/`)) return;
    const key = url.slice(this.publicBaseUrl.length + 1);
    if (!key) return;

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete stale S3 object "${key}": ${(err as Error).message}`);
    }
  }
}
