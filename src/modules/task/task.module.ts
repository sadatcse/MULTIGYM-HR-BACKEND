import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { TaskAssignee, TaskAssigneeSchema } from './schemas/task-assignee.schema';
import { TaskAuditLog, TaskAuditLogSchema } from './schemas/task-audit-log.schema';
import { TaskUpdate, TaskUpdateSchema } from './schemas/task-update.schema';
import { TaskReminder, TaskReminderSchema } from './schemas/task-reminder.schema';
import { TaskCategory, TaskCategorySchema } from './schemas/task-category.schema';
import { Employee, EmployeeSchema } from '../user/schemas/employee.schema';
import { TaskService } from './task.service';
import { TaskReminderService } from './task-reminder.service';
import { TaskController } from './task.controller';
import { ChatModule } from '../chat/chat.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskAssignee.name, schema: TaskAssigneeSchema },
      { name: TaskAuditLog.name, schema: TaskAuditLogSchema },
      { name: TaskUpdate.name, schema: TaskUpdateSchema },
      { name: TaskReminder.name, schema: TaskReminderSchema },
      { name: TaskCategory.name, schema: TaskCategorySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    ChatModule,
    RolePermissionModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskReminderService],
  exports: [TaskService, TaskReminderService],
})
export class TaskModule {}
