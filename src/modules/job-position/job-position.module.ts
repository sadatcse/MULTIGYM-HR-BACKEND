import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobPositionService } from './job-position.service';
import { JobPositionController } from './job-position.controller';
import { JobPosition, JobPositionSchema } from './schemas/job-position.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: JobPosition.name, schema: JobPositionSchema }])],
  controllers: [JobPositionController],
  providers: [JobPositionService],
  exports: [JobPositionService],
})
export class JobPositionModule {}
