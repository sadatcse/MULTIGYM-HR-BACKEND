import { Module } from '@nestjs/common';
import { TaskModule } from '../task/task.module';
import { AccountabilityModule } from '../accountability/accountability.module';
import { CronController } from './cron.controller';

@Module({
  imports: [TaskModule, AccountabilityModule],
  controllers: [CronController],
})
export class CronModule {}
