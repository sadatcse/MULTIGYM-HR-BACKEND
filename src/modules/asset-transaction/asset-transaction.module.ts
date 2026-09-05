import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetTransaction, AssetTransactionSchema } from './schemas/asset-transaction.schema';
import { AssetTransactionService } from './asset-transaction.service';
import { AssetTransactionController } from './asset-transaction.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AssetTransaction.name, schema: AssetTransactionSchema }]),
  ],
  controllers: [AssetTransactionController],
  providers: [AssetTransactionService],
  exports: [AssetTransactionService],
})
export class AssetTransactionModule {}
