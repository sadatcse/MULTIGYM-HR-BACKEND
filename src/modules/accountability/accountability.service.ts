import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notice, NoticeDocument, NoticeStatus } from '../notice/schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientDocument, RecipientStatus } from '../notice/schemas/notice-recipient.schema';
import { Task, TaskDocument, TaskStatus } from '../task/schemas/task.schema';
import { TaskAssignee, TaskAssigneeDocument } from '../task/schemas/task-assignee.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CommunicationType, CommunicationEvent, CommunicationEventDocument } from './schemas/communication-event.schema';
import { AttentionQueueQueryDto, GlobalSearchQueryDto } from './dto/accountability-query.dto';

@Injectable()
export class AccountabilityService {
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
    @InjectModel(CommunicationEvent.name)
    private readonly eventModel: Model<CommunicationEventDocument>,
  ) {}

  private getUserId(user: any): Types.ObjectId {
    const rawId = user?._id || user?.id || user?.sub || user?.userId;
    return new Types.ObjectId(rawId?.toString());
  }

  // 1. Unified Management Command Center Metrics
  async getDashboardMetrics(user?: any): Promise<any> {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [
      totalTasks,
      activeTasks,
      waitingApprovalTasks,
      completedTasks,
      overdueTasks,
      dueTodayTasks,
      totalNotices,
      pendingNoticeAcks,
      unseenNoticeDeliveries,
      sourceBreakdown,
      recentEvents,
    ] = await Promise.all([
      this.taskModel.countDocuments(),
      this.taskModel.countDocuments({
        status: { $in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.WAITING_FOR_APPROVAL] },
      }),
      this.taskModel.countDocuments({ status: TaskStatus.WAITING_FOR_APPROVAL }),
      this.taskModel.countDocuments({ status: TaskStatus.COMPLETED }),
      this.taskModel.countDocuments({
        deadline: { $lt: now },
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      }),
      this.taskModel.countDocuments({
        deadline: { $gte: now, $lte: endOfDay },
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      }),
      this.noticeModel.countDocuments({ status: NoticeStatus.PUBLISHED }),
      this.noticeRecipientModel.countDocuments({
        status: { $in: [RecipientStatus.DELIVERED, RecipientStatus.SEEN] },
      }),
      this.noticeRecipientModel.countDocuments({ firstSeenAt: { $in: [null, undefined] } }),
      this.taskModel.aggregate([
        {
          $group: {
            _id: '$instructionSource',
            count: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] } },
            overdue: {
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
      ]),
      this.eventModel
        .find()
        .populate('actor', 'name employeeId role photo')
        .populate('targetUser', 'name employeeId role photo')
        .sort({ timestamp: -1 })
        .limit(8)
        .lean(),
    ]);

    const totalCommunications = totalTasks + totalNotices;

    return {
      overview: {
        totalCommunications,
        totalTasks,
        activeTasks,
        totalNotices,
        unseenNotices: unseenNoticeDeliveries,
        pendingAcknowledgements: pendingNoticeAcks,
        dueToday: dueTodayTasks,
        overdue: overdueTasks,
        waitingApproval: waitingApprovalTasks,
        completed: completedTasks,
        complianceHealthRate:
          totalCommunications > 0
            ? Math.round(((completedTasks + (totalNotices - pendingNoticeAcks)) / (totalCommunications * 2 || 1)) * 100)
            : 100,
      },
      sourceBreakdown: sourceBreakdown.map((s) => ({
        source: s._id || 'Management',
        total: s.count,
        completed: s.completed,
        overdue: s.overdue,
      })),
      recentActivity: recentEvents,
    };
  }

  // 2. Unified "Requires Attention" Queue
  async getAttentionQueue(query: AttentionQueueQueryDto, user?: any): Promise<any> {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const items: any[] = [];

    // Category 1: Critical Overdue Tasks
    if (!query.category || query.category === 'all' || query.category === 'critical') {
      const overdueTasks = await this.taskModel
        .find({
          deadline: { $lt: now },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        })
        .populate('issuedBy', 'name employeeId role')
        .populate('createdBy', 'name employeeId')
        .sort({ deadline: 1 })
        .limit(20)
        .lean();

      for (const t of overdueTasks) {
        items.push({
          id: t._id,
          type: CommunicationType.TASK,
          title: t.title,
          source: t.instructionSource || 'Management',
          priority: t.priority,
          severity: 'CRITICAL',
          category: 'critical',
          status: t.status,
          deadline: t.deadline,
          message: `Task is overdue by ${Math.ceil((now.getTime() - new Date(t.deadline).getTime()) / (1000 * 60 * 60 * 24))} day(s)`,
          actionUrl: `/dashboard/tasks/${t._id}`,
          actionLabel: 'View Task & Directives',
          createdAt: (t as any).createdAt,
        });
      }
    }

    // Category 2: Tasks Waiting for Approval
    if (!query.category || query.category === 'all' || query.category === 'waiting_approval') {
      const approvalTasks = await this.taskModel
        .find({ status: TaskStatus.WAITING_FOR_APPROVAL })
        .populate('issuedBy', 'name employeeId role')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();

      for (const t of approvalTasks) {
        items.push({
          id: t._id,
          type: CommunicationType.APPROVAL_REQUEST,
          title: t.title,
          source: t.instructionSource || 'Management',
          priority: t.priority,
          severity: 'HIGH',
          category: 'waiting_approval',
          status: t.status,
          deadline: t.deadline,
          message: 'Staff submission received with proof. Awaiting manager signoff.',
          actionUrl: `/dashboard/tasks/${t._id}`,
          actionLabel: 'Review & Approve',
          createdAt: (t as any).createdAt,
        });
      }
    }

    // Category 3: Tasks Due Today / Due Soon
    if (!query.category || query.category === 'all' || query.category === 'due_soon') {
      const dueSoonTasks = await this.taskModel
        .find({
          deadline: { $gte: now, $lte: threeDaysFromNow },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.WAITING_FOR_APPROVAL] },
        })
        .populate('issuedBy', 'name employeeId')
        .sort({ deadline: 1 })
        .limit(20)
        .lean();

      for (const t of dueSoonTasks) {
        const isToday = new Date(t.deadline) <= endOfDay;
        items.push({
          id: t._id,
          type: CommunicationType.TASK,
          title: t.title,
          source: t.instructionSource || 'Management',
          priority: t.priority,
          severity: isToday ? 'HIGH' : 'MEDIUM',
          category: 'due_soon',
          status: t.status,
          deadline: t.deadline,
          message: isToday ? 'Directive deadline is TODAY' : 'Directive due within 3 days',
          actionUrl: `/dashboard/tasks/${t._id}`,
          actionLabel: 'Follow Up',
          createdAt: (t as any).createdAt,
        });
      }
    }

    // Category 4: Notices with Pending Acknowledgements
    if (!query.category || query.category === 'all' || query.category === 'pending_ack') {
      const pendingNotices = await this.noticeModel
        .find({
          status: NoticeStatus.PUBLISHED,
          requiresAcknowledgement: true,
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      for (const n of pendingNotices) {
        const pendingCount = await this.noticeRecipientModel.countDocuments({
          notice: n._id,
          status: { $in: [RecipientStatus.DELIVERED, RecipientStatus.SEEN] },
        });

        if (pendingCount > 0) {
          items.push({
            id: n._id,
            type: CommunicationType.NOTICE,
            title: n.title,
            source: 'Admin & HR',
            priority: n.priority,
            severity: 'MEDIUM',
            category: 'pending_ack',
            status: n.status,
            deadline: n.acknowledgementDeadline,
            message: `${pendingCount} employee(s) have not acknowledged this notice yet`,
            actionUrl: `/dashboard/notices/${n._id}/monitor`,
            actionLabel: 'Monitor & Send Reminder',
            createdAt: (n as any).createdAt,
          });
        }
      }
    }

    // Sort attention items: CRITICAL first, then HIGH, then MEDIUM
    const severityOrder: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    items.sort((a, b) => (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5));

    return {
      total: items.length,
      items,
    };
  }

  // 3. Employee Combined Obligations ("My Responsibilities")
  async getMyObligations(user: any): Promise<any> {
    const userId = this.getUserId(user);
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. My Notices requiring attention (Unseen or Pending Acknowledgement)
    const myRecipients = await this.noticeRecipientModel
      .find({
        employee: userId,
        status: { $nin: [RecipientStatus.ACKNOWLEDGED, RecipientStatus.ACKNOWLEDGED_LATE] },
      })
      .populate('notice', 'title content category priority acknowledgementDeadline createdAt status')
      .lean();

    const pendingNotices = myRecipients
      .filter((r) => r.notice && (r.notice as any).status === NoticeStatus.PUBLISHED)
      .map((r) => {
        const n: any = r.notice;
        return {
          id: n._id,
          type: CommunicationType.NOTICE,
          title: n.title,
          category: n.category,
          priority: n.priority,
          isSeen: !!r.firstSeenAt,
          firstSeenAt: r.firstSeenAt,
          requiresAck: true,
          deadline: n.acknowledgementDeadline,
          isOverdue: n.acknowledgementDeadline && new Date(n.acknowledgementDeadline) < now,
          actionUrl: `/dashboard/notices/my-notices`,
        };
      });

    // 2. My Active Task Assignments
    const myAssignments = await this.taskAssigneeModel
      .find({
        employee: userId,
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      })
      .populate('task', 'title instructionSource priority deadline status progress approvalRequired completionProofRequired')
      .lean();

    const activeTasks = myAssignments
      .filter((a) => a.task)
      .map((a) => {
        const t: any = a.task;
        const deadline = new Date(t.deadline);
        const isOverdue = deadline < now;
        const isDueToday = deadline >= now && deadline <= endOfDay;

        return {
          id: t._id,
          type: CommunicationType.TASK,
          title: t.title,
          source: t.instructionSource || 'Management',
          priority: t.priority,
          myStatus: a.status,
          myProgress: a.progress || 0,
          deadline: t.deadline,
          isOverdue,
          isDueToday,
          actionUrl: `/dashboard/tasks/my-tasks`,
        };
      });

    const unreadNoticeCount = pendingNotices.filter((n) => !n.isSeen).length;
    const pendingAckCount = pendingNotices.length;
    const activeTaskCount = activeTasks.length;
    const overdueCount =
      pendingNotices.filter((n) => n.isOverdue).length + activeTasks.filter((t) => t.isOverdue).length;
    const dueTodayCount = activeTasks.filter((t) => t.isDueToday).length;

    return {
      summary: {
        totalObligations: pendingNotices.length + activeTasks.length,
        unreadNotices: unreadNoticeCount,
        pendingAcknowledgements: pendingAckCount,
        activeTasks: activeTaskCount,
        dueToday: dueTodayCount,
        overdue: overdueCount,
      },
      notices: pendingNotices,
      tasks: activeTasks,
    };
  }

  // 4. Unified Full-Text Search
  async searchAll(query: GlobalSearchQueryDto, user?: any): Promise<any> {
    const q = query.q?.trim();
    if (!q) return { results: [], total: 0 };

    const regex = new RegExp(q, 'i');
    const limit = query.limit || 20;

    const [tasks, notices, employees] = await Promise.all([
      this.taskModel
        .find({
          $or: [{ title: regex }, { description: regex }, { instructionSource: regex }, { category: regex }],
        })
        .select('title instructionSource priority status deadline category createdAt')
        .limit(limit)
        .lean(),
      this.noticeModel
        .find({
          $or: [{ title: regex }, { content: regex }, { category: regex }],
        })
        .select('title category priority status acknowledgementDeadline createdAt')
        .limit(limit)
        .lean(),
      this.employeeModel
        .find({
          $or: [{ name: regex }, { employeeId: regex }, { department: regex }, { email: regex }],
        })
        .select('name employeeId department branches role email photo')
        .limit(10)
        .lean(),
    ]);

    const results: any[] = [];

    tasks.forEach((t) => {
      results.push({
        id: t._id,
        type: CommunicationType.TASK,
        title: t.title,
        subtitle: `Source: ${t.instructionSource} • Status: ${t.status}`,
        priority: t.priority,
        deadline: t.deadline,
        url: `/dashboard/tasks/${t._id}`,
      });
    });

    notices.forEach((n) => {
      results.push({
        id: n._id,
        type: CommunicationType.NOTICE,
        title: n.title,
        subtitle: `Notice • Category: ${n.category || 'General'}`,
        priority: n.priority,
        deadline: n.acknowledgementDeadline,
        url: `/dashboard/notices/${n._id}/monitor`,
      });
    });

    employees.forEach((e) => {
      results.push({
        id: e._id,
        type: 'EMPLOYEE',
        title: e.name,
        subtitle: `${e.employeeId || ''} • ${e.department || ''} • ${(e.branches || []).join(', ')}`,
        url: `/dashboard/accountability/reports?employee=${e._id}`,
      });
    });

    return {
      query: q,
      total: results.length,
      results,
    };
  }
}
