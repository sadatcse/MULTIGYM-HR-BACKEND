import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionLog, TransactionLogSchema } from './schemas/transaction-log.schema';
import { TransactionLogService } from './transaction-log.service';
import { TransactionLogController } from './transaction-log.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TransactionLog.name, schema: TransactionLogSchema }]),
  ],
  controllers: [TransactionLogController],
  providers: [TransactionLogService],
  exports: [MongooseModule],
})
export class TransactionLogModule {}
