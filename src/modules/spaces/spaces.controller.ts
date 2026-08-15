import { Controller, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { SpacesService } from './spaces.service';

// Ported from config/space.js's getImageUrl(). Unused in the original app (never
// mounted to any route) and unused here — SpacesModule is not imported by AppModule.
// It expects `req.files.image` (express-fileupload's convention), but no such
// middleware was ever wired up in the original app either.
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Post('image-url')
  async getImageUrl(@Req() request: Request, @Query('pathName') pathName: string) {
    const image = (request as any)?.files?.image;

    const imageUrl = `${pathName}/${Date.now() + '-' + image.name}`;
    console.log(imageUrl);

    const resp = await this.spacesService.uploadObject(imageUrl, image.data);

    console.log(resp, 'resp');
    return { path: imageUrl };
  }
}
