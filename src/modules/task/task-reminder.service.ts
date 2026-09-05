import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './schemas/task.schema';
import { TaskAssignee, TaskAssigneeDocument } from './schemas/task-assignee.schema';
import {
  TaskReminder,
  TaskReminderDocument,
  TaskReminderType,
} from './schemas/task-reminder.schema';
import {
  TaskAuditLog,
  TaskAuditLogDocument,
  TaskEventType,
} from './schemas/task-audit-log.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { ChatGateway } from '../chat/chat.gateway';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes

@Injectable()
export class TaskReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignee.name)
    private readonly assigneeModel: Model<TaskAssigneeDocument>,
    @InjectModel(TaskReminder.name)
    private readonly reminderModel: Model<TaskReminderDocument>,
    @InjectModel(TaskAuditLog.name)
    private readonly auditLogModel: Model<TaskAuditLogDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.logger.log('Task Reminder & Escalation Engine initialized');
    // Run initial evaluation shortly after startup (after 10s to let connection settle)
    setTimeout(() => {
      this.evaluateAllTasks().catch((err) =>
        this.logger.error(`Initial reminder scan failed: ${(err as Error).message}`),
      );
    }, 10000);

    // Schedule periodic runs
    this.intervalRef = setInterval(() => {
      this.evaluateAllTasks().catch((err) =>
        this.logger.error(`Periodic reminder scan failed: ${(err as Error).message}`),
      );
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  // Idempotent evaluation of all active tasks
  async evaluateAllTasks(): Promise<{ processedCount: number; remindersSent: number; overdueCount: number }> {
    if (this.isProcessing) {
      this.logger.debug('Evaluation already in progress, skipping concurrent run');
      return { processedCount: 0, remindersSent: 0, overdueCount: 0 };
    }

    this.isProcessing = true;
    let remindersSent = 0;
    let overdueCount = 0;

    try {
      const now = new Date();

      // Find all active tasks
      const activeTasks = await this.taskModel.find({
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      });

      for (const task of activeTasks) {
        const deadline = new Date(task.deadline);
        const isPast = deadline.getTime() < now.getTime();

        // 1. Mark overdue if deadline passed
        if (isPast) {
          if (!task.isOverdue) {
            task.isOverdue = true;
            task.wasOverdue = true;
            if (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) {
              task.status = TaskStatus.OVERDUE;
            }
            await task.save();
            overdueCount++;

            await this.auditLogModel.create({
              task: task._id,
              actor: task.createdBy,
              eventType: TaskEventType.TASK_OVERDUE,
              comment: `Task deadline passed on ${deadline.toISOString()}`,
              timestamp: new Date(),
            });
          }
        }

        // 2. Fetch assignees
        const assignees = await this.assigneeModel.find({
          task: task._id,
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        });

        // 3. Evaluate each assignee's reminders
        for (const assignee of assignees) {
          // If task is waiting for approval, stop employee deadline reminders
          if (assignee.status === TaskStatus.WAITING_FOR_APPROVAL) {
            continue;
          }

          const diffMs = deadline.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let reminderType: TaskReminderType | null = null;
          let message = '';

          if (diffDays === 7) {
            reminderType = TaskReminderType.SEVEN_DAYS_BEFORE;
            message = `Task "${task.title}" is due in 7 days (${task.instructionSource}).`;
          } else if (diffDays === 3) {
            reminderType = TaskReminderType.THREE_DAYS_BEFORE;
            message = `Task "${task.title}" is due in 3 days.`;
          } else if (diffDays === 1) {
            reminderType = TaskReminderType.ONE_DAY_BEFORE;
            message = `Reminder: Task "${task.title}" is due tomorrow!`;
          } else if (diffDays === 0 && !isPast) {
            reminderType = TaskReminderType.DUE_TODAY;
            message = `URGENT: Task "${task.title}" is due today!`;
          } else if (isPast) {
            const overdueDays = Math.abs(diffDays);
            if (overdueDays === 1) {
              reminderType = TaskReminderType.OVERDUE_DAY_1;
              message = `OVERDUE: Task "${task.title}" is 1 day overdue.`;
            } else if (overdueDays === 2) {
              reminderType = TaskReminderType.ESCALATION_ADMIN;
              message = `ESCALATION: Task "${task.title}" is 2 days overdue (Admin notified).`;
            } else if (overdueDays >= 3) {
              reminderType = TaskReminderType.ESCALATION_MANAGEMENT;
              message = `CRITICAL ESCALATION: Task "${task.title}" is ${overdueDays} days overdue!`;
            }
          }

          if (reminderType) {
            const sent = await this.dispatchReminderSafely(
              task,
              assignee.employee.toString(),
              reminderType,
              message,
            );
            if (sent) remindersSent++;
          }
        }
      }

      this.logger.log(
        `Task evaluation complete: ${activeTasks.length} tasks scanned, ${remindersSent} reminders dispatched, ${overdueCount} newly overdue`,
      );

      return { processedCount: activeTasks.length, remindersSent, overdueCount };
    } finally {
      this.isProcessing = false;
    }
  }

  // Idempotent dispatch: Attempt insert with unique index. If duplicate key error occurs, skip!
  private async dispatchReminderSafely(
    task: TaskDocument,
    employeeId: string,
    reminderType: TaskReminderType,
    message: string,
  ): Promise<boolean> {
    try {
      // Check existing record first for speed
      const exists = await this.reminderModel.findOne({
        task: task._id,
        employee: employeeId,
        reminderType,
      });
      if (exists) return false;

      // Create reminder record
      await this.reminderModel.create({
        task: task._id,
        employee: employeeId,
        reminderType,
        scheduledDate: new Date(),
        sentAt: new Date(),
        status: 'SENT',
        message,
      });

      // Record audit log
      const isEscalation =
        reminderType === TaskReminderType.ESCALATION_ADMIN ||
        reminderType === TaskReminderType.ESCALATION_MANAGEMENT;

      await this.auditLogModel.create({
        task: task._id,
        actor: task.createdBy,
        targetEmployee: employeeId,
        eventType: isEscalation ? TaskEventType.TASK_ESCALATED : TaskEventType.TASK_REMINDER_SENT,
        comment: message,
        metadata: { reminderType, message },
        timestamp: new Date(),
      });

      // Send live websocket event
      try {
        this.chatGateway.server?.to(employeeId).emit('task:reminder', {
          taskId: task._id,
          title: task.title,
          reminderType,
          message,
          priority: task.priority,
          deadline: task.deadline,
        });
      } catch {
        // Socket errors are non-fatal
      }

      return true;
    } catch (err: any) {
      // Duplicate key error code 11000 indicates it was already sent in another run
      if (err.code === 11000) {
        return false;
      }
      this.logger.warn(`Failed to dispatch reminder to ${employeeId}: ${err.message}`);
      return false;
    }
  }
}
