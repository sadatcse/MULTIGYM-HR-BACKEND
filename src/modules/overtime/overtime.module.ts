import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { OvertimePolicy, OvertimePolicySchema } from './schemas/overtime-policy.schema';
import { OvertimeRecord, OvertimeRecordSchema } from './schemas/overtime-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OvertimePolicy.name, schema: OvertimePolicySchema },
      { name: OvertimeRecord.name, schema: OvertimeRecordSchema },
    ]),
  ],
  controllers: [OvertimeController],
  providers: [OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
