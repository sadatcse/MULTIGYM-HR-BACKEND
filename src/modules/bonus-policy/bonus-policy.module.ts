import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BonusPolicyService } from './bonus-policy.service';
import { BonusPolicyController } from './bonus-policy.controller';
import { BonusPolicy, BonusPolicySchema } from './schemas/bonus-policy.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BonusPolicy.name, schema: BonusPolicySchema }]),
  ],
  controllers: [BonusPolicyController],
  providers: [BonusPolicyService],
  exports: [BonusPolicyService],
})
export class BonusPolicyModule {}
