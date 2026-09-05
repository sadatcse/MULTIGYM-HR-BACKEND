import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notice, NoticeDocument } from '../notice/schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientDocument, RecipientStatus } from '../notice/schemas/notice-recipient.schema';
import { Task, TaskDocument, TaskStatus } from '../task/schemas/task.schema';
import { TaskAssignee, TaskAssigneeDocument } from '../task/schemas/task-assignee.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { ReportQueryDto } from './dto/accountability-query.dto';

@Injectable()
export class AccountabilityReportService {
  constructor(
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
  ) {}

  async generateReport(type: string, query: ReportQueryDto): Promise<any> {
    const now = new Date();

    if (type === 'communication-summary') {
      // Source-wise Breakdown across all instructions & notices
      const taskSourceAgg = await this.taskModel.aggregate([
        {
          $group: {
            _id: '$instructionSource',
            totalTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] } },
            inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] } },
            pendingTasks: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.PENDING] }, 1, 0] } },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', TaskStatus.COMPLETED] },
                      { $ne: ['$status', TaskStatus.CANCELLED] },
                      { $lt: ['$deadline', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { totalTasks: -1 } },
      ]);

      const noticeCount = await this.noticeModel.countDocuments();
      const totalAcks = await this.noticeRecipientModel.countDocuments({
        status: { $in: [RecipientStatus.ACKNOWLEDGED, RecipientStatus.ACKNOWLEDGED_LATE] },
      });
      const totalNoticeDeliveries = await this.noticeRecipientModel.countDocuments();

      return {
        sourceBreakdown: taskSourceAgg.map((s) => ({
          source: s._id || 'Management',
          total: s.totalTasks,
          completed: s.completedTasks,
          inProgress: s.inProgressTasks,
          pending: s.pendingTasks,
          overdue: s.overdueTasks,
          completionRate: s.totalTasks > 0 ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0,
        })),
        noticeStats: {
          totalPublished: noticeCount,
          totalDeliveries: totalNoticeDeliveries,
          acknowledged: totalAcks,
          complianceRate: totalNoticeDeliveries > 0 ? Math.round((totalAcks / totalNoticeDeliveries) * 100) : 0,
        },
      };
    }

    if (type === 'employee-accountability') {
      // Complete per-employee accountability matrix
      const employees = await this.employeeModel
        .find({ status: { $ne: 'deleted' } })
        .select('name employeeId department branch role email photo')
        .sort({ name: 1 })
        .limit(100)
        .lean();

      const empIds = employees.map((e) => e._id);

      // Aggregate notice participation
      const noticeRecipients = await this.noticeRecipientModel
        .find({ employee: { $in: empIds } })
        .select('employee status firstSeenAt')
        .lean();

      const noticeMap = new Map<string, { total: number; seen: number; acknowledged: number }>();
      for (const nr of noticeRecipients) {
        const empId = nr.employee.toString();
        if (!noticeMap.has(empId)) {
          noticeMap.set(empId, { total: 0, seen: 0, acknowledged: 0 });
        }
        const item = noticeMap.get(empId)!;
        item.total++;
        if (nr.firstSeenAt) item.seen++;
        if (nr.status === RecipientStatus.ACKNOWLEDGED || nr.status === RecipientStatus.ACKNOWLEDGED_LATE) {
          item.acknowledged++;
        }
      }

      // Aggregate task assignments
      const taskAssignees = await this.taskAssigneeModel
        .find({ employee: { $in: empIds } })
        .populate('task', 'deadline status')
        .lean();

      const taskMap = new Map<string, { total: number; inProgress: number; completed: number; overdue: number; waitingApproval: number }>();
      for (const ta of taskAssignees) {
        const empId = ta.employee.toString();
        if (!taskMap.has(empId)) {
          taskMap.set(empId, { total: 0, inProgress: 0, completed: 0, overdue: 0, waitingApproval: 0 });
        }
        const item = taskMap.get(empId)!;
        item.total++;
        if (ta.status === TaskStatus.COMPLETED) item.completed++;
        else if (ta.status === TaskStatus.IN_PROGRESS) item.inProgress++;
        else if (ta.status === TaskStatus.WAITING_FOR_APPROVAL) item.waitingApproval++;

        const taskObj: any = ta.task;
        if (
          taskObj &&
          ta.status !== TaskStatus.COMPLETED &&
          ta.status !== TaskStatus.CANCELLED &&
          new Date(taskObj.deadline) < now
        ) {
          item.overdue++;
        }
      }

      return employees.map((emp, idx) => {
        const empId = emp._id.toString();
        const nData = noticeMap.get(empId) || { total: 0, seen: 0, acknowledged: 0 };
        const tData = taskMap.get(empId) || { total: 0, inProgress: 0, completed: 0, overdue: 0, waitingApproval: 0 };

        return {
          sl: idx + 1,
          employeeId: emp.employeeId || 'N/A',
          name: emp.name,
          department: emp.department || 'N/A',
          branch: emp.branch || 'N/A',
          noticesReceived: nData.total,
          noticesSeen: nData.seen,
          noticesAcknowledged: nData.acknowledged,
          tasksAssigned: tData.total,
          tasksInProgress: tData.inProgress,
          tasksCompleted: tData.completed,
          tasksWaitingApproval: tData.waitingApproval,
          tasksOverdue: tData.overdue,
          taskCompletionRate: tData.total > 0 ? Math.round((tData.completed / tData.total) * 100) : 0,
        };
      });
    }

    if (type === 'deadline-compliance') {
      // Global on-time vs late audit
      const allTasks = await this.taskModel.find().select('deadline status completedAt title instructionSource priority').lean();
      let onTimeCount = 0;
      let lateCompletedCount = 0;
      let overdueActiveCount = 0;
      let pendingOnSchedule = 0;

      for (const t of allTasks) {
        const deadline = new Date(t.deadline);
        if (t.status === TaskStatus.COMPLETED) {
          if (t.completedAt && new Date(t.completedAt) <= deadline) {
            onTimeCount++;
          } else {
            lateCompletedCount++;
          }
        } else if (t.status !== TaskStatus.CANCELLED) {
          if (deadline < now) {
            overdueActiveCount++;
          } else {
            pendingOnSchedule++;
          }
        }
      }

      const total = allTasks.length;
      return {
        summary: {
          totalDirectives: total,
          onTimeCompleted: onTimeCount,
          lateCompleted: lateCompletedCount,
          overdueActive: overdueActiveCount,
          onScheduleActive: pendingOnSchedule,
          onTimeSuccessRate: total > 0 ? Math.round((onTimeCount / total) * 100) : 0,
        },
        records: allTasks.slice(0, 50),
      };
    }

    throw new BadRequestException(`Unsupported accountability report type: ${type}`);
  }
}
