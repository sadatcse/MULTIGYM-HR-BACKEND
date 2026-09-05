import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notice, NoticeSchema } from './schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientSchema } from './schemas/notice-recipient.schema';
import { NoticeAuditLog, NoticeAuditLogSchema } from './schemas/notice-audit-log.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { NoticeService } from './notice.service';
import { NoticeController } from './notice.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notice.name, schema: NoticeSchema },
      { name: NoticeRecipient.name, schema: NoticeRecipientSchema },
      { name: NoticeAuditLog.name, schema: NoticeAuditLogSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [NoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
