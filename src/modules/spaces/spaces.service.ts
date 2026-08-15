import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Ported from config/space.js. Unused in the original app (nothing imports it) and
// unused here — SpacesModule is not imported by AppModule.
@Injectable()
export class SpacesService {
  private createClient() {
    return new S3Client({
      // endpoint: "https://sgp1.digitaloceanspaces.com", // Find your endpoint in the control panel, under Settings. Prepend "https://".
      forcePathStyle: false,
      region: 'ap-southeast-1', // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (e.g. nyc3).
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID as string,
        secretAccessKey: process.env.SPACES_SECRET as string,
      },
    });
  }

  async uploadObject(key: string, file: any, mimetype?: string) {
    const client = this.createClient();
    const uploadParams = {
      Bucket: process.env.BUCKET,
      Key: key,
      Body: file,
      Metadata: {},
      ContentType: mimetype || 'image',
    };

    try {
      const data = await client.send(new PutObjectCommand(uploadParams as any));
      console.log(
        'Successfully uploaded object: ' + uploadParams.Bucket + '/' + uploadParams.Key,
      );
      return data;
    } catch (err) {
      console.log('Error', err);
    }
  }

  async deleteObject(key: string) {
    const client = this.createClient();
    const deleteParams = { Bucket: process.env.BUCKET, Key: key };

    try {
      const data = await client.send(new DeleteObjectCommand(deleteParams as any));
      console.log(
        'Successfully deleted object: ' + deleteParams.Bucket + '/' + deleteParams.Key,
      );
      return data;
    } catch (err) {
      console.log('Error', err);
    }
  }

  async updateObject(createKey: string, file: any, deleteKey: string, mimetype?: string) {
    const client = this.createClient();
    const uploadParams = {
      Bucket: process.env.BUCKET,
      Key: createKey,
      Body: file,
      ACL: 'public-read',
      Metadata: {},
      ContentType: mimetype || 'image',
    };
    const deleteParams = { Bucket: process.env.BUCKET, Key: deleteKey };

    try {
      await client.send(new PutObjectCommand(uploadParams as any));
      console.log(
        'Successfully uploaded object: ' + uploadParams.Bucket + '/' + uploadParams.Key,
      );
    } catch (err) {
      console.log('Error', err);
    }

    try {
      await client.send(new DeleteObjectCommand(deleteParams as any));
      console.log(
        'Successfully deleted object: ' + deleteParams.Bucket + '/' + deleteParams.Key,
      );
    } catch (err) {
      console.log('Error', err);
    }
  }
}
