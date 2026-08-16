import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvancePolicyService } from './advance-policy.service';
import { AdvancePolicyController } from './advance-policy.controller';
import { AdvancePolicy, AdvancePolicySchema } from './schemas/advance-policy.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AdvancePolicy.name, schema: AdvancePolicySchema }]),
  ],
  controllers: [AdvancePolicyController],
  providers: [AdvancePolicyService],
  exports: [AdvancePolicyService],
})
export class AdvancePolicyModule {}
