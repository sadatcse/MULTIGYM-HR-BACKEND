import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LatePolicyService } from './late-policy.service';
import { LatePolicyController } from './late-policy.controller';
import { LatePolicy, LatePolicySchema } from './schemas/late-policy.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LatePolicy.name, schema: LatePolicySchema }]),
  ],
  controllers: [LatePolicyController],
  providers: [LatePolicyService],
  exports: [LatePolicyService],
})
export class LatePolicyModule {}
