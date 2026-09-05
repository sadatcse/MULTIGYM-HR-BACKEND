import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CommunicationEvent,
  CommunicationEventSchema,
} from './schemas/communication-event.schema';
import {
  CommunicationReminder,
  CommunicationReminderSchema,
} from './schemas/communication-reminder.schema';
import { Notice, NoticeSchema } from '../notice/schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientSchema } from '../notice/schemas/notice-recipient.schema';
import { Task, TaskSchema } from '../task/schemas/task.schema';
import { TaskAssignee, TaskAssigneeSchema } from '../task/schemas/task-assignee.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { AccountabilityService } from './accountability.service';
import { AccountabilityEventService } from './accountability-event.service';
import { UnifiedReminderService } from './unified-reminder.service';
import { AccountabilityReportService } from './accountability-report.service';
import { AccountabilityController } from './accountability.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommunicationEvent.name, schema: CommunicationEventSchema },
      { name: CommunicationReminder.name, schema: CommunicationReminderSchema },
      { name: Notice.name, schema: NoticeSchema },
      { name: NoticeRecipient.name, schema: NoticeRecipientSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TaskAssignee.name, schema: TaskAssigneeSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    ChatModule,
  ],
  controllers: [AccountabilityController],
  providers: [
    AccountabilityService,
    AccountabilityEventService,
    UnifiedReminderService,
    AccountabilityReportService,
  ],
  exports: [
    AccountabilityService,
    AccountabilityEventService,
    UnifiedReminderService,
    AccountabilityReportService,
  ],
})
export class AccountabilityModule {}
