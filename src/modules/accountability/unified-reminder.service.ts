import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CommunicationReminder,
  CommunicationReminderDocument,
  CommonReminderType,
} from './schemas/communication-reminder.schema';
import {
  CommunicationType,
  AccountabilityEventType,
} from './schemas/communication-event.schema';
import { AccountabilityEventService } from './accountability-event.service';
import { Notice, NoticeDocument, NoticeStatus } from '../notice/schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientDocument, RecipientStatus } from '../notice/schemas/notice-recipient.schema';
import { Task, TaskDocument, TaskStatus } from '../task/schemas/task.schema';
import { TaskAssignee, TaskAssigneeDocument } from '../task/schemas/task-assignee.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { ChatGateway } from '../chat/chat.gateway';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes

@Injectable()
export class UnifiedReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UnifiedReminderService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @InjectModel(CommunicationReminder.name)
    private readonly reminderModel: Model<CommunicationReminderDocument>,
    @InjectModel(Notice.name)
    private readonly noticeModel: Model<NoticeDocument>,
    @InjectModel(NoticeRecipient.name)
    private readonly noticeRecipientModel: Model<NoticeRecipientDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignee.name)
    private readonly taskAssigneeModel: Model<TaskAssigneeDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    private readonly eventService: AccountabilityEventService,
    @Optional()
    private readonly chatGateway?: ChatGateway,
  ) {}

  onModuleInit() {
    this.logger.log('Unified Management Reminder & Escalation Engine initialized');

    // Run initial evaluation 10 seconds after boot
    setTimeout(() => {
      this.evaluateAllCommunications().catch((err) =>
        this.logger.error(`Initial reminder scan error: ${(err as Error).message}`),
      );
      this.eventService.syncHistoricalDataIfEmpty().catch(() => {});
    }, 10000);

    // Schedule recurring interval
    this.intervalRef = setInterval(() => {
      this.evaluateAllCommunications().catch((err) =>
        this.logger.error(`Periodic reminder scan error: ${(err as Error).message}`),
      );
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  // Master evaluation method: evaluates both Notice acknowledgements & Task completion
  async evaluateAllCommunications(): Promise<{
    noticeRemindersSent: number;
    taskRemindersSent: number;
    newlyOverdueTasks: number;
  }> {
    if (this.isProcessing) {
      this.logger.debug('Evaluation in progress, skipping concurrent run');
      return { noticeRemindersSent: 0, taskRemindersSent: 0, newlyOverdueTasks: 0 };
    }

    this.isProcessing = true;
    let noticeRemindersSent = 0;
    let taskRemindersSent = 0;
    let newlyOverdueTasks = 0;

    try {
      const now = new Date();

      // --- 1. NOTICE ACKNOWLEDGEMENT EVALUATION ---
      const activeNotices = await this.noticeModel.find({
        status: NoticeStatus.PUBLISHED,
        requiresAcknowledgement: true,
        acknowledgementDeadline: { $exists: true, $ne: null },
      });

      for (const notice of activeNotices) {
        if (!notice.acknowledgementDeadline) continue;
        const deadline = new Date(notice.acknowledgementDeadline);
        const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isPast = deadline.getTime() < now.getTime();

        // Get recipients who have not acknowledged
        const pendingRecipients = await this.noticeRecipientModel.find({
          notice: notice._id,
          status: { $in: [RecipientStatus.DELIVERED, RecipientStatus.SEEN] },
        });

        for (const r of pendingRecipients) {
          let reminderType: CommonReminderType | null = null;
          let message = '';

          if (isPast) {
            reminderType = CommonReminderType.OVERDUE_DAY_1;
            message = `URGENT: Acknowledgement for "${notice.title}" was due on ${deadline.toLocaleDateString()}. Please confirm immediately.`;
          } else if (daysDiff === 0) {
            reminderType = CommonReminderType.DUE_TODAY;
            message = `Notice "${notice.title}" requires your acknowledgement today by ${deadline.toLocaleTimeString()}.`;
          } else if (daysDiff === 1) {
            reminderType = CommonReminderType.BEFORE_1D;
            message = `Notice "${notice.title}" requires your acknowledgement by tomorrow.`;
          }

          if (reminderType) {
            const sent = await this.dispatchReminder({
              communicationId: notice._id,
              communicationType: CommunicationType.NOTICE,
              targetEmployee: r.employee as any,
              reminderType,
              title: `Notice Acknowledgement: ${notice.title}`,
              message,
            });
            if (sent) noticeRemindersSent++;
          }
        }
      }

      // --- 2. TASK / INSTRUCTION EVALUATION ---
      const activeTasks = await this.taskModel.find({
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      });

      for (const task of activeTasks) {
        const deadline = new Date(task.deadline);
        const isPast = deadline.getTime() < now.getTime();
        const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Detect newly overdue task
        if (isPast && !task.isOverdue) {
          task.isOverdue = true;
          task.wasOverdue = true;
          if (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) {
            task.status = TaskStatus.OVERDUE;
          }
          await task.save();
          newlyOverdueTasks++;

          await this.eventService.recordEvent({
            communicationId: task._id,
            communicationType: CommunicationType.TASK,
            title: task.title,
            source: task.instructionSource,
            eventType: AccountabilityEventType.COMMUNICATION_OVERDUE,
            actor: task.createdBy as any,
            branch: task.branch,
            department: task.department,
            previousStatus: TaskStatus.IN_PROGRESS,
            newStatus: TaskStatus.OVERDUE,
            comment: `Task passed deadline of ${deadline.toISOString()} without completion`,
          });
        }

        // Smart reminder rules: If waiting approval, do not pester employee, remind manager instead
        if (task.status === TaskStatus.WAITING_FOR_APPROVAL) {
          // Remind creator / admin that review is pending
          if (task.createdBy) {
            await this.dispatchReminder({
              communicationId: task._id,
              communicationType: CommunicationType.TASK,
              targetEmployee: task.createdBy as any,
              reminderType: CommonReminderType.APPROVAL_PENDING,
              title: `Task Review Pending: ${task.title}`,
              message: `Staff has submitted proof for "${task.title}". Management review is pending.`,
            });
          }
          continue;
        }

        // Determine reminder type based on daysDiff
        const assignees = await this.taskAssigneeModel.find({
          task: task._id,
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        });

        for (const a of assignees) {
          let reminderType: CommonReminderType | null = null;
          let message = '';

          if (isPast) {
            const overdueDays = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
            if (overdueDays >= 3) {
              reminderType = CommonReminderType.OVERDUE_ESCALATION_MANAGEMENT;
              message = `CRITICAL ESCALATION: Task "${task.title}" is ${overdueDays} days overdue. Escalated to Director / Management.`;
            } else if (overdueDays >= 2) {
              reminderType = CommonReminderType.OVERDUE_ESCALATION_ADMIN;
              message = `ESCALATION: Task "${task.title}" is ${overdueDays} days overdue. Admin notified.`;
            } else {
              reminderType = CommonReminderType.OVERDUE_DAY_1;
              message = `OVERDUE: Task "${task.title}" was due on ${deadline.toLocaleDateString()}. Please complete immediately.`;
            }
          } else if (daysDiff === 0) {
            reminderType = CommonReminderType.DUE_TODAY;
            message = `REMINDER: Task "${task.title}" is due today (${deadline.toLocaleTimeString()}).`;
          } else if (daysDiff === 1) {
            reminderType = CommonReminderType.BEFORE_1D;
            message = `REMINDER: Task "${task.title}" is due tomorrow.`;
          } else if (daysDiff === 3) {
            reminderType = CommonReminderType.BEFORE_3D;
            message = `UPCOMING: Task "${task.title}" is due in 3 days.`;
          } else if (daysDiff === 7) {
            reminderType = CommonReminderType.BEFORE_7D;
            message = `UPCOMING: Task "${task.title}" is due in 7 days.`;
          }

          if (reminderType) {
            const sent = await this.dispatchReminder({
              communicationId: task._id,
              communicationType: CommunicationType.TASK,
              targetEmployee: a.employee as any,
              reminderType,
              title: `Directive Reminder: ${task.title}`,
              message,
            });
            if (sent) taskRemindersSent++;
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error during reminder evaluation: ${(err as Error).message}`);
    } finally {
      this.isProcessing = false;
    }

    return { noticeRemindersSent, taskRemindersSent, newlyOverdueTasks };
  }

  // Idempotent reminder dispatch using MongoDB unique compound index
  private async dispatchReminder(params: {
    communicationId: Types.ObjectId;
    communicationType: CommunicationType;
    targetEmployee: Types.ObjectId;
    reminderType: CommonReminderType;
    title: string;
    message: string;
  }): Promise<boolean> {
    try {
      // 1. Create reminder record with compound unique index
      await this.reminderModel.create({
        communicationId: params.communicationId,
        communicationType: params.communicationType,
        targetEmployee: params.targetEmployee,
        reminderType: params.reminderType,
        channel: 'IN_APP',
        title: params.title,
        message: params.message,
        sentAt: new Date(),
      });

      // 2. Broadcast via socket if client connected
      try {
        this.chatGateway?.server?.to(params.targetEmployee.toString()).emit('communication_reminder', {
          communicationId: params.communicationId,
          type: params.communicationType,
          reminderType: params.reminderType,
          title: params.title,
          message: params.message,
          timestamp: new Date(),
        });
      } catch {
        // Socket broadcast optional
      }

      // 3. Log to unified audit stream
      await this.eventService.recordEvent({
        communicationId: params.communicationId,
        communicationType: params.communicationType,
        title: params.title,
        eventType: AccountabilityEventType.COMMUNICATION_REMINDER_SENT,
        actor: params.targetEmployee,
        targetUser: params.targetEmployee,
        comment: `Reminder [${params.reminderType}] dispatched: ${params.message}`,
        metadata: { reminderType: params.reminderType },
      });

      return true;
    } catch (err: any) {
      // Duplicate key error (code 11000) indicates reminder already sent -> idempotent skip
      if (err.code === 11000) {
        return false;
      }
      this.logger.warn(`Failed to dispatch reminder: ${err.message}`);
      return false;
    }
  }
}
