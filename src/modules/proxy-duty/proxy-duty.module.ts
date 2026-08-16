import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProxyDutyService } from './proxy-duty.service';
import { ProxyDutyController } from './proxy-duty.controller';
import { ProxyDuty, ProxyDutySchema } from './schemas/proxy-duty.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProxyDuty.name, schema: ProxyDutySchema }]),
  ],
  controllers: [ProxyDutyController],
  providers: [ProxyDutyService],
  exports: [ProxyDutyService],
})
export class ProxyDutyModule {}
