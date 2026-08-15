import { Module } from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { SpacesController } from './spaces.controller';

// Not imported by AppModule — mirrors the original, where config/space.js existed
// but nothing ever called it.
@Module({
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
