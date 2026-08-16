import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GymCalendarDate, GymCalendarDateSchema } from './schemas/gym-calendar.schema';
import { GymWeeklyDefault, GymWeeklyDefaultSchema } from './schemas/gym-weekly-default.schema';
import { GymCalendarService } from './gym-calendar.service';
import { GymCalendarController } from './gym-calendar.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GymCalendarDate.name, schema: GymCalendarDateSchema },
      { name: GymWeeklyDefault.name, schema: GymWeeklyDefaultSchema },
    ]),
  ],
  controllers: [GymCalendarController],
  providers: [GymCalendarService],
  exports: [GymCalendarService],
})
export class GymCalendarModule {}
