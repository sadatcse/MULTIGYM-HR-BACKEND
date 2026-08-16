import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeaveTypeService } from './leave-type.service';
import { LeaveTypeController } from './leave-type.controller';
import { LeaveType, LeaveTypeSchema } from './schemas/leave-type.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LeaveType.name, schema: LeaveTypeSchema }]),
  ],
  controllers: [LeaveTypeController],
  providers: [LeaveTypeService],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
