import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Task,
  TaskDocument,
  TaskStatus,
  InstructionSource,
  TaskPriority,
  CompletionCondition,
} from './schemas/task.schema';
import {
  TaskAssignee,
  TaskAssigneeDocument,
} from './schemas/task-assignee.schema';
import {
  TaskAuditLog,
  TaskAuditLogDocument,
  TaskEventType,
} from './schemas/task-audit-log.schema';
import {
  TaskUpdate,
  TaskUpdateDocument,
} from './schemas/task-update.schema';
import {
  TaskReminder,
  TaskReminderDocument,
} from './schemas/task-reminder.schema';
import {
  TaskCategory,
  TaskCategoryDocument,
} from './schemas/task-category.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CreateTaskDto, SubtaskItemDto } from './dto/create-task.dto';
import {
  UpdateTaskDto,
  UpdateProgressDto,
  UploadProofDto,
  BatchUploadProofDto,
  SubmitTaskDto,
  ApproveTaskDto,
  RejectTaskDto,
  ExtendDeadlineDto,
  CancelTaskDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/task-actions.dto';
import { ChatGateway } from '../chat/chat.gateway';

const DEFAULT_CATEGORIES = [
  'Management Instruction',
  'HR',
  'Attendance',
  'Recruitment',
  'Operations',
  'Finance',
  'Marketing',
  'IT',
  'Branch Operations',
  'Maintenance',
  'Procurement',
  'Training',
  'Compliance',
  'Customer Service',
  'Other',
];

const ADMIN_ROLES = ['SUPERADMIN', 'SUPER ADMIN', 'ADMIN', 'DIRECTOR', 'MANAGER', 'MD'];

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignee.name)
    private readonly assigneeModel: Model<TaskAssigneeDocument>,
    @InjectModel(TaskAuditLog.name)
    private readonly auditLogModel: Model<TaskAuditLogDocument>,
    @InjectModel(TaskUpdate.name)
    private readonly updateModel: Model<TaskUpdateDocument>,
    @InjectModel(TaskReminder.name)
    private readonly reminderModel: Model<TaskReminderDocument>,
    @InjectModel(TaskCategory.name)
    private readonly categoryModel: Model<TaskCategoryDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @Optional()
    private readonly chatGateway?: ChatGateway,
  ) {}

  async onModuleInit() {
    // Seed default categories if none exist
    try {
      const count = await this.categoryModel.countDocuments();
      if (count === 0) {
        const seed = DEFAULT_CATEGORIES.map((cat, idx) => ({
          name: cat,
          order: idx + 1,
          status: 'active',
          isSystem: true,
        }));
        await this.categoryModel.insertMany(seed);
        this.logger.log(`Initialized ${seed.length} default task categories`);
      }
    } catch (err) {
      this.logger.warn(`Category seeding skipped: ${(err as Error).message}`);
    }
  }

  private isManagerOrAdmin(role?: string): boolean {
    if (!role) return false;
    return ADMIN_ROLES.includes(role.toUpperCase());
  }

  getUserId(user: any): Types.ObjectId {
    const rawId = user?._id || user?.id || user?.sub || user?.userId;
    if (!rawId) throw new BadRequestException('User context missing from authentication');
    return new Types.ObjectId(rawId.toString());
  }

  // Record an auditable event
  async logAuditEvent(
    taskId: string | Types.ObjectId,
    actorId: string | Types.ObjectId,
    eventType: TaskEventType,
    options: {
      targetEmployeeId?: string | Types.ObjectId | any;
      previousState?: any;
      newState?: any;
      comment?: string;
      metadata?: Record<string, any>;
    } = {},
  ) {
    try {
      await this.auditLogModel.create({
        task: taskId,
        actor: actorId,
        targetEmployee: options.targetEmployeeId,
        eventType,
        previousState: options.previousState,
        newState: options.newState,
        comment: options.comment,
        metadata: options.metadata,
        timestamp: new Date(),
      });
    } catch (err) {
      this.logger.error(`Failed to record audit log: ${(err as Error).message}`);
    }
  }

  // CREATE TASK
  async createTask(dto: CreateTaskDto, user: any) {
    const directAssigneeIds = dto.assigneeIds || [];
    const itemAssigneeIds = (dto.items || []).flatMap((it) => it.assigneeIds || []);
    const allUniqueAssigneeIds = Array.from(new Set([...directAssigneeIds, ...itemAssigneeIds]));

    if (allUniqueAssigneeIds.length === 0) {
      throw new BadRequestException('At least one employee must be assigned to this task or subtask');
    }

    // Verify assignees exist
    const validEmployees = await this.employeeModel
      .find({ _id: { $in: allUniqueAssigneeIds } })
      .select('_id name email role branch department');
    if (validEmployees.length === 0) {
      throw new BadRequestException('No valid assignees found for provided IDs');
    }

    const actorId = this.getUserId(user);
    const issuedById = dto.issuedById ? new Types.ObjectId(dto.issuedById) : actorId;

    const subtaskItems = (dto.items || []).map((it) => ({
      _id: it._id ? new Types.ObjectId(it._id) : new Types.ObjectId(),
      title: it.title.trim(),
      description: it.description?.trim(),
      assignees: (it.assigneeIds || []).map((id) => new Types.ObjectId(id)),
      priority: it.priority || dto.priority || TaskPriority.MEDIUM,
      deadline: it.deadline ? new Date(it.deadline) : new Date(dto.deadline),
      status: TaskStatus.PENDING,
      progress: 0,
      approvalRequired: it.approvalRequired ?? dto.approvalRequired ?? false,
      completionProofRequired: it.completionProofRequired ?? dto.completionProofRequired ?? false,
      proofs: [],
    }));

    const taskDoc = new this.taskModel({
      title: dto.title.trim(),
      description: dto.description.trim(),
      instructionSource: dto.instructionSource,
      instructionSourceCustom: dto.instructionSourceCustom?.trim(),
      issuedBy: issuedById,
      branch: dto.branch?.trim() || 'All Branches',
      department: dto.department?.trim() || 'All Departments',
      category: dto.category?.trim() || 'Management Instruction',
      priority: dto.priority || TaskPriority.MEDIUM,
      instructionDate: dto.instructionDate ? new Date(dto.instructionDate) : new Date(),
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      deadline: new Date(dto.deadline),
      status: TaskStatus.PENDING,
      progress: 0,
      approvalRequired: dto.approvalRequired ?? false,
      completionProofRequired: dto.completionProofRequired ?? false,
      completionCondition: dto.completionCondition || CompletionCondition.ALL_ASSIGNEES,
      attachments: dto.attachments || [],
      items: subtaskItems,
      remarks: dto.remarks?.trim(),
      relatedNotice: dto.relatedNoticeId ? new Types.ObjectId(dto.relatedNoticeId) : undefined,
      relatedEmployee: dto.relatedEmployeeId ? new Types.ObjectId(dto.relatedEmployeeId) : undefined,
      relatedProject: dto.relatedProject?.trim(),
      estimatedEffort: dto.estimatedEffort?.trim(),
      isRecurring: dto.isRecurring ?? false,
      recurrence: dto.isRecurring && dto.recurrence?.endDate ? dto.recurrence : undefined,
      reminderSchedule: dto.reminderSchedule || [7, 3, 1, 0, -1],
      createdBy: actorId,
      isOverdue: new Date(dto.deadline) < new Date(),
    });

    const savedTask = await taskDoc.save();

    // Create individual assignee records
    const assigneeDocs = validEmployees.map((emp) => ({
      task: savedTask._id,
      employee: emp._id,
      status: TaskStatus.PENDING,
      progress: 0,
    }));
    await this.assigneeModel.insertMany(assigneeDocs);

    // Audit logs
    await this.logAuditEvent(savedTask._id, actorId, TaskEventType.TASK_CREATED, {
      newState: { status: TaskStatus.PENDING, deadline: savedTask.deadline },
      comment: `Task created from instruction source "${savedTask.instructionSource}"`,
    });

    for (const emp of validEmployees) {
      await this.logAuditEvent(savedTask._id, actorId, TaskEventType.TASK_ASSIGNED, {
        targetEmployeeId: emp._id,
        comment: `Assigned to ${emp.name}`,
      });

      // Realtime notification through ChatGateway socket
      try {
        this.chatGateway?.server?.to(emp._id.toString()).emit('task:assigned', {
          taskId: savedTask._id,
          title: savedTask.title,
          instructionSource: savedTask.instructionSource,
          priority: savedTask.priority,
          deadline: savedTask.deadline,
        });
      } catch {
        // Socket emit failure is non-fatal
      }
    }

    return this.findById(savedTask._id.toString(), user);
  }

  // FIND ALL TASKS (Filterable, Paginated, Scoped)
  async findAll(query: any, user: any) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Search term in title or description
    if (query.search?.trim()) {
      filter.$or = [
        { title: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    if (query.source && query.source !== 'all') {
      filter.instructionSource = query.source;
    }

    if (query.branch && query.branch !== 'all' && query.branch !== 'All Branches') {
      filter.branch = { $in: [query.branch, 'All Branches'] };
    }

    if (query.department && query.department !== 'all' && query.department !== 'All Departments') {
      filter.department = { $in: [query.department, 'All Departments'] };
    }

    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }

    if (query.priority && query.priority !== 'all') {
      filter.priority = query.priority.toUpperCase();
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status.toUpperCase();
    }

    if (query.isOverdue === 'true' || query.isOverdue === true) {
      filter.isOverdue = true;
      filter.status = { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] };
    }

    // Role-based scoping: regular employee can only see tasks where they are assigned or creator
    const isManager = this.isManagerOrAdmin(user?.role);
    if (!isManager && user) {
      const userId = this.getUserId(user);
      const myAssignments = await this.assigneeModel
        .find({ employee: userId })
        .select('task');
      const taskIds = myAssignments.map((a) => a.task);
      filter.$or = [
        ...(filter.$or ? [filter.$or] : []),
        { _id: { $in: taskIds } },
        { createdBy: userId },
      ];
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      filter.deadline = {};
      if (query.startDate) filter.deadline.$gte = new Date(query.startDate);
      if (query.endDate) filter.deadline.$lte = new Date(query.endDate);
    }

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .populate('issuedBy', 'name email photo employeeId role')
        .populate('createdBy', 'name email employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.taskModel.countDocuments(filter),
    ]);

    // Attach assignees summary to each task
    const taskIds = tasks.map((t) => t._id);
    const assignees = await this.assigneeModel
      .find({ task: { $in: taskIds } })
      .populate('employee', 'name email photo employeeId department branch')
      .lean();

    const assigneeMap = new Map<string, any[]>();
    assignees.forEach((a) => {
      const tId = a.task.toString();
      if (!assigneeMap.has(tId)) assigneeMap.set(tId, []);
      assigneeMap.get(tId)?.push(a);
    });

    const enrichedTasks = tasks.map((t) => {
      const taskAssignees = assigneeMap.get(t._id.toString()) || [];
      const now = new Date();
      const isPastDeadline = new Date(t.deadline) < now;
      const isOverdue =
        isPastDeadline &&
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED;

      return {
        ...t,
        assignees: taskAssignees,
        isOverdue,
        totalAssignees: taskAssignees.length,
        completedAssignees: taskAssignees.filter((a) => a.status === TaskStatus.COMPLETED).length,
      };
    });

    return {
      tasks: enrichedTasks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET EMPLOYEE PERSONAL TASKS ("My Tasks")
  async getMyTasks(query: any, user: any) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const userId = this.getUserId(user);
    const filter: any = { employee: userId };

    if (query.status && query.status !== 'all') {
      filter.status = query.status.toUpperCase();
    }

    const [assignments, total] = await Promise.all([
      this.assigneeModel
        .find(filter)
        .populate({
          path: 'task',
          populate: [
            { path: 'issuedBy', select: 'name email photo employeeId' },
            { path: 'createdBy', select: 'name email' },
          ],
        })
        .populate('approvedBy', 'name employeeId')
        .populate('rejectionHistory.rejectedBy', 'name employeeId')
        .populate('submissionHistory.reviewedBy', 'name employeeId')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.assigneeModel.countDocuments(filter),
    ]);

    // Add smart deadline calculation to each item
    const now = new Date();
    const enriched = assignments
      .filter((a) => a.task) // Guard against any dangling references
      .map((a) => {
        const task = a.task as any;
        const deadline = new Date(task.deadline);
        const diffMs = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let deadlineText = '';
        if (diffDays < 0) {
          deadlineText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
        } else if (diffDays === 0) {
          deadlineText = 'Due Today';
        } else if (diffDays === 1) {
          deadlineText = 'Due Tomorrow';
        } else {
          deadlineText = `${diffDays} days remaining`;
        }

        return {
          ...a,
          deadlineText,
          isOverdue: diffDays < 0 && a.status !== TaskStatus.COMPLETED,
          daysRemaining: diffDays,
        };
      });

    return {
      assignments: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // FIND TASK BY ID (Full detail, assignees, proofs, timeline)
  async findById(id: string, user?: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid task ID format');
    }

    const task = await this.taskModel
      .findById(id)
      .populate('issuedBy', 'name email photo employeeId role department branch')
      .populate('createdBy', 'name email photo employeeId role')
      .populate('relatedNotice', 'title category priority')
      .populate('relatedEmployee', 'name email employeeId department branch')
      .populate('deadlineHistory.changedBy', 'name employeeId')
      .populate('cancelledBy', 'name employeeId')
      .populate('items.assignees', 'name email photo employeeId department branch')
      .populate('items.approvedBy', 'name employeeId')
      .lean();

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    // Load assignees with employee profile
    const assignees = await this.assigneeModel
      .find({ task: id })
      .populate('employee', 'name email photo employeeId department branch jobPosition mobileNumber')
      .populate('approvedBy', 'name employeeId')
      .populate('rejectionHistory.rejectedBy', 'name employeeId')
      .populate('submissionHistory.reviewedBy', 'name employeeId')
      .lean();

    // Check RBAC permission for regular employees
    const isManager = this.isManagerOrAdmin(user?.role);
    if (!isManager && user?.id) {
      const isAssigned = assignees.some((a) => (a.employee as any)?._id?.toString() === user.id);
      const isCreator = (task.createdBy as any)?._id?.toString() === user.id;
      if (!isAssigned && !isCreator) {
        throw new ForbiddenException('You are not authorized to view this task');
      }
    }

    // Dynamic submission rankings calculation
    const submittedAssignees = assignees
      .filter((a) => a.submittedAt)
      .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());

    const rankMap = new Map<string, number>();
    submittedAssignees.forEach((a, index) => {
      rankMap.set(a._id.toString(), index + 1);
    });

    const now = new Date();
    const enrichedAssignees = assignees.map((a) => {
      const calculatedRank = rankMap.get(a._id.toString()) || a.submissionRank || null;
      const deadlineDate = new Date(task.deadline);
      let isOnTime = false;
      let isLate = false;
      const isDone = a.status === TaskStatus.COMPLETED || a.status === TaskStatus.APPROVED;
      if (a.completedAt) {
        isOnTime = new Date(a.completedAt) <= deadlineDate;
        isLate = !isOnTime;
      } else if (a.submittedAt) {
        isOnTime = new Date(a.submittedAt) <= deadlineDate;
        isLate = !isOnTime;
      } else if (now > deadlineDate && !isDone) {
        isLate = true;
      } else {
        isOnTime = true;
      }

      return {
        ...a,
        submissionRank: calculatedRank,
        isOnTime,
        isLate,
      };
    });

    // Comparative Analytics (Requirements 6, 7 & 10)
    const startedList = [...enrichedAssignees]
      .filter((a) => a.startedAt)
      .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime());
    const submittedList = [...enrichedAssignees]
      .filter((a) => a.submittedAt)
      .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
    const ratedList = [...enrichedAssignees]
      .filter((a) => a.rating !== undefined && a.rating !== null)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    const comparativeAnalytics = {
      totalAssignees: enrichedAssignees.length,
      submittedCount: submittedList.length,
      completedCount: enrichedAssignees.filter(
        (a) => a.status === TaskStatus.COMPLETED || a.status === TaskStatus.APPROVED
      ).length,
      startedFirst: startedList[0]
        ? { employee: startedList[0].employee, time: startedList[0].startedAt }
        : null,
      submittedFirst: submittedList[0]
        ? { employee: submittedList[0].employee, time: submittedList[0].submittedAt }
        : null,
      submittedLast:
        submittedList.length > 1
          ? {
              employee: submittedList[submittedList.length - 1].employee,
              time: submittedList[submittedList.length - 1].submittedAt,
            }
          : null,
      highestRating: ratedList[0]
        ? { employee: ratedList[0].employee, rating: ratedList[0].rating }
        : null,
      lowestRating:
        ratedList.length > 1
          ? {
              employee: ratedList[ratedList.length - 1].employee,
              rating: ratedList[ratedList.length - 1].rating,
            }
          : null,
      onTimeCount: enrichedAssignees.filter((a) => a.isOnTime && (a.submittedAt || a.completedAt))
        .length,
      lateCount: enrichedAssignees.filter((a) => a.isLate).length,
      averageRating:
        ratedList.length > 0
          ? Math.round(
              ratedList.reduce((sum, a) => sum + (a.rating || 0), 0) / ratedList.length
            )
          : 0,
    };

    // Load timeline audit stream
    const timeline = await this.auditLogModel
      .find({ task: id })
      .populate('actor', 'name email photo employeeId role')
      .populate('targetEmployee', 'name employeeId')
      .sort({ timestamp: -1 })
      .lean();

    // Load progress updates and comments
    const updates = await this.updateModel
      .find({ task: id })
      .populate('employee', 'name email photo employeeId')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate smart status
    const isPastDeadline = new Date(task.deadline) < now;
    const isOverdue =
      isPastDeadline &&
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.CANCELLED;

    return {
      ...task,
      isOverdue,
      assignees: enrichedAssignees,
      comparativeAnalytics,
      timeline,
      updates,
    };
  }

  // START TASK (Employee starts working)
  async startTask(id: string, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    if (assignee.status !== TaskStatus.PENDING) {
      return { message: 'Task is already in progress or completed', assignee };
    }

    const previousStatus = assignee.status;
    assignee.status = TaskStatus.IN_PROGRESS;
    assignee.startedAt = new Date();
    assignee.lastUpdateAt = new Date();
    await assignee.save();

    // If overall task was pending, mark as in progress
    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.IN_PROGRESS;
      await task.save();
    }

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_STARTED, {
      previousState: { status: previousStatus },
      newState: { status: TaskStatus.IN_PROGRESS },
      comment: 'Employee started working on the task',
    });

    return { success: true, message: 'Task started successfully', assignee };
  }

  // UPDATE PROGRESS
  async updateProgress(id: string, dto: UpdateProgressDto, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    const prevProgress = assignee.progress;
    assignee.progress = dto.progress;
    assignee.lastUpdateAt = new Date();
    if (dto.remark) assignee.latestRemark = dto.remark.trim();
    if (assignee.status === TaskStatus.PENDING) {
      assignee.status = TaskStatus.IN_PROGRESS;
      assignee.startedAt = new Date();
    }
    await assignee.save();

    // Create a progress update record
    if (dto.remark || (dto.attachments && dto.attachments.length > 0)) {
      await this.updateModel.create({
        task: task._id,
        employee: userId,
        progress: dto.progress,
        comment: dto.remark || `Progress updated to ${dto.progress}%`,
        attachments: dto.attachments || [],
      });
    }

    // Recompute overall task progress (average across assignees)
    const allAssignees = await this.assigneeModel.find({ task: id });
    const avgProgress = Math.round(
      allAssignees.reduce((acc, curr) => acc + (curr.progress || 0), 0) / (allAssignees.length || 1),
    );
    task.progress = avgProgress;
    if (task.status === TaskStatus.PENDING) task.status = TaskStatus.IN_PROGRESS;
    await task.save();

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_PROGRESS_UPDATED, {
      previousState: { progress: prevProgress },
      newState: { progress: dto.progress },
      comment: dto.remark ? `Progress updated to ${dto.progress}%: ${dto.remark}` : `Progress updated to ${dto.progress}%`,
    });

    return { success: true, message: 'Progress updated successfully', progress: dto.progress, overallProgress: avgProgress };
  }

  // UPLOAD COMPLETION PROOF
  async uploadProof(id: string, dto: UploadProofDto, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    const currentProofs = assignee.proofs || [];
    const nextVersion = currentProofs.length + 1;

    const newProof = {
      name: dto.name,
      url: dto.url,
      fileType: dto.fileType,
      size: dto.size,
      uploadedAt: new Date(),
      version: nextVersion,
      remark: dto.remark?.trim(),
    };

    assignee.proofs.push(newProof);
    assignee.lastUpdateAt = new Date();
    await assignee.save();

    // If subtaskId provided, also save to subtask item
    if (dto.subtaskId && task.items && task.items.length > 0) {
      const item = task.items.find((it) => it._id.toString() === dto.subtaskId);
      if (item) {
        if (!item.proofs) item.proofs = [];
        item.proofs.push(newProof as any);
        await task.save();
      }
    }

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_ATTACHMENT_UPLOADED, {
      newState: { proof: newProof },
      comment: `Uploaded completion proof (v${nextVersion}): ${dto.name}`,
    });

    return { success: true, message: 'Completion proof uploaded successfully', proof: newProof };
  }

  // BATCH UPLOAD COMPLETION PROOFS
  async batchUploadProofs(id: string, dto: BatchUploadProofDto, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    if (!dto.proofs || dto.proofs.length === 0) {
      throw new BadRequestException('At least one proof file must be provided');
    }

    let nextVersion = (assignee.proofs?.length || 0) + 1;
    const newProofs = dto.proofs.map((p) => ({
      name: p.name,
      url: p.url,
      fileType: p.fileType,
      size: p.size,
      uploadedAt: new Date(),
      version: nextVersion++,
      remark: (p.remark || dto.remark)?.trim(),
    }));

    assignee.proofs.push(...newProofs);
    assignee.lastUpdateAt = new Date();
    await assignee.save();

    if (dto.subtaskId && task.items && task.items.length > 0) {
      const item = task.items.find((it) => it._id.toString() === dto.subtaskId);
      if (item) {
        if (!item.proofs) item.proofs = [];
        item.proofs.push(...(newProofs as any));
        await task.save();
      }
    }

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_ATTACHMENT_UPLOADED, {
      comment: `Uploaded ${newProofs.length} completion proof attachments`,
    });

    return { success: true, message: `${newProofs.length} proofs uploaded successfully`, proofs: newProofs };
  }

  // SUBMIT FOR APPROVAL
  async submitForApproval(id: string, dto: SubmitTaskDto, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    const now = new Date();
    if (!assignee.submissionHistory) assignee.submissionHistory = [];
    const currentCycle = assignee.submissionHistory.length + 1;

    const currentProofsSnapshot = (assignee.proofs || []).map((p) => ({
      name: p.name,
      url: p.url,
      fileType: p.fileType,
      size: p.size,
      uploadedAt: p.uploadedAt || now,
      version: p.version || 1,
      remark: p.remark,
    }));

    const submissionRemark = dto.remark?.trim() || assignee.latestRemark || '';

    assignee.submissionHistory.push({
      cycle: currentCycle,
      submittedAt: now,
      remark: submissionRemark,
      proofs: currentProofsSnapshot,
      status: TaskStatus.SUBMITTED,
    });

    assignee.status = TaskStatus.SUBMITTED;
    assignee.submittedAt = now;
    assignee.lastSubmittedAt = now;
    assignee.submissionCount = currentCycle;
    assignee.progress = 100;
    if (dto.remark) assignee.latestRemark = dto.remark.trim();

    // Calculate dynamic submission rank among assignees for this task
    const priorSubmittedCount = await this.assigneeModel.countDocuments({
      task: id,
      submittedAt: { $exists: true, $ne: null, $lt: assignee.submittedAt },
    });
    assignee.submissionRank = priorSubmittedCount + 1;
    await assignee.save();

    // If subtaskId provided, also update subtask item
    if (dto.subtaskId && task.items && task.items.length > 0) {
      const item = task.items.find((it) => it._id.toString() === dto.subtaskId);
      if (item) {
        item.status = TaskStatus.SUBMITTED;
        item.submittedAt = new Date();
        item.progress = 100;
      }
    }

    // Move overall task status to WAITING_FOR_APPROVAL
    task.status = TaskStatus.WAITING_FOR_APPROVAL;
    await task.save();

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_SUBMITTED_FOR_APPROVAL, {
      newState: { status: TaskStatus.SUBMITTED, submissionRank: assignee.submissionRank },
      comment: dto.remark ? `Submitted for approval: ${dto.remark}` : 'Submitted for management approval',
    });

    return { success: true, message: 'Task submitted for approval successfully', submissionRank: assignee.submissionRank };
  }

  // APPROVE TASK (With Work Quality Rating & Comments)
  async approveTask(id: string, dto: ApproveTaskDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can approve tasks');
    }

    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const actorId = this.getUserId(user);
    const queryFilter: any = { task: id };
    if (dto.assigneeEmployeeId) {
      queryFilter.employee = dto.assigneeEmployeeId;
    } else {
      queryFilter.status = {
        $in: [TaskStatus.WAITING_FOR_APPROVAL, TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW],
      };
    }

    const assigneesToApprove = await this.assigneeModel.find(queryFilter);
    if (assigneesToApprove.length === 0) {
      throw new BadRequestException('No assignees found pending approval');
    }

    for (const a of assigneesToApprove) {
      a.status = TaskStatus.COMPLETED;
      a.completedAt = new Date();
      a.approvedBy = actorId as any;
      a.approvedAt = new Date();
      a.progress = 100;
      if (dto.rating !== undefined) a.rating = dto.rating;
      if (dto.comment) a.approvalComment = dto.comment.trim();

      if (a.submissionHistory && a.submissionHistory.length > 0) {
        const latestSubmission = a.submissionHistory[a.submissionHistory.length - 1];
        latestSubmission.status = TaskStatus.APPROVED;
        latestSubmission.reviewedBy = actorId as any;
        latestSubmission.reviewedAt = new Date();
        if (dto.comment) latestSubmission.reviewComment = dto.comment.trim();
        if (dto.rating !== undefined) latestSubmission.rating = dto.rating;
      }

      await a.save();

      // If subtaskId provided, also update subtask item
      if (dto.subtaskId && task.items && task.items.length > 0) {
        const item = task.items.find((it) => it._id.toString() === dto.subtaskId);
        if (item) {
          item.status = TaskStatus.COMPLETED;
          item.completedAt = new Date();
          item.approvedBy = actorId as any;
          item.approvedAt = new Date();
          if (dto.rating !== undefined) item.rating = dto.rating;
          if (dto.comment) item.approvalComment = dto.comment.trim();
        }
      }

      await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_APPROVED, {
        targetEmployeeId: a.employee,
        comment: `Approved: ${dto.comment || 'Task submission approved'}${dto.rating !== undefined ? ` (Work Quality Rating: ${dto.rating}%)` : ''}`,
        metadata: { rating: dto.rating, comment: dto.comment },
      });
    }

    // Evaluate overall task completion
    const allAssignees = await this.assigneeModel.find({ task: id });
    const allCompleted = allAssignees.every((a) => a.status === TaskStatus.COMPLETED || a.status === TaskStatus.APPROVED);
    const anyCompleted = allAssignees.some((a) => a.status === TaskStatus.COMPLETED || a.status === TaskStatus.APPROVED);

    const shouldComplete =
      task.completionCondition === CompletionCondition.ANY_ASSIGNEE
        ? anyCompleted
        : allCompleted;

    if (shouldComplete) {
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.progress = 100;
      await task.save();

      await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_COMPLETED, {
        newState: { status: TaskStatus.COMPLETED },
        comment: 'All approval conditions satisfied; task completed',
      });
    } else {
      await task.save();
    }

    return { success: true, message: 'Task approved successfully' };
  }

  // REJECT TASK (Revision Requested with Auditable History)
  async rejectTask(id: string, dto: RejectTaskDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can reject tasks');
    }

    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const actorId = this.getUserId(user);
    const queryFilter: any = { task: id };
    if (dto.assigneeEmployeeId) {
      queryFilter.employee = dto.assigneeEmployeeId;
    }

    const assigneesToReject = await this.assigneeModel.find(queryFilter);
    if (assigneesToReject.length === 0) {
      throw new BadRequestException('No matching assignees found to reject');
    }

    for (const a of assigneesToReject) {
      a.status = TaskStatus.REJECTED;
      a.rejectionReason = dto.reason.trim();
      a.lastUpdateAt = new Date();
      if (!a.rejectionHistory) a.rejectionHistory = [];
      a.rejectionHistory.push({
        reason: dto.reason.trim(),
        rejectedBy: actorId as any,
        rejectedAt: new Date(),
      });

      if (a.submissionHistory && a.submissionHistory.length > 0) {
        const latestSubmission = a.submissionHistory[a.submissionHistory.length - 1];
        latestSubmission.status = TaskStatus.REJECTED;
        latestSubmission.reviewedBy = actorId as any;
        latestSubmission.reviewedAt = new Date();
        latestSubmission.reviewComment = dto.reason.trim();
      }

      await a.save();

      // If subtaskId provided, also update subtask item
      if (dto.subtaskId && task.items && task.items.length > 0) {
        const item = task.items.find((it) => it._id.toString() === dto.subtaskId);
        if (item) {
          item.status = TaskStatus.REJECTED;
          item.rejectionReason = dto.reason.trim();
        }
      }

      await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_REJECTED, {
        targetEmployeeId: a.employee,
        comment: `Submission rejected / revision requested: ${dto.reason.trim()}`,
      });
    }

    // Set overall task back to IN_PROGRESS
    task.status = TaskStatus.IN_PROGRESS;
    await task.save();

    return { success: true, message: 'Task rejected and returned for revision' };
  }

  // DIRECT COMPLETE (when approval is not required)
  async completeTaskDirect(id: string, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    if (task.approvalRequired) {
      throw new BadRequestException('This task requires management approval. Please submit for approval.');
    }

    const userId = this.getUserId(user);
    const assignee = await this.assigneeModel.findOne({ task: id, employee: userId });
    if (!assignee) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    if (task.completionProofRequired && (!assignee.proofs || assignee.proofs.length === 0)) {
      throw new BadRequestException('Completion proof is required before marking this task complete');
    }

    assignee.status = TaskStatus.COMPLETED;
    assignee.completedAt = new Date();
    assignee.progress = 100;
    await assignee.save();

    // Check completion condition
    const allAssignees = await this.assigneeModel.find({ task: id });
    const allCompleted = allAssignees.every((a) => a.status === TaskStatus.COMPLETED);
    const anyCompleted = allAssignees.some((a) => a.status === TaskStatus.COMPLETED);

    const shouldComplete =
      task.completionCondition === CompletionCondition.ANY_ASSIGNEE
        ? anyCompleted
        : allCompleted;

    if (shouldComplete) {
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.progress = 100;
      await task.save();
    }

    await this.logAuditEvent(task._id, userId, TaskEventType.TASK_COMPLETED, {
      targetEmployeeId: userId,
      comment: 'Task marked completed by employee',
    });

    return { success: true, message: 'Task completed successfully' };
  }

  // EXTEND DEADLINE — see approveTask's comment on why this keeps a
  // hardcoded management-tier gate alongside the configurable permission.
  async extendDeadline(id: string, dto: ExtendDeadlineDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can extend deadlines');
    }

    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const actorId = this.getUserId(user);
    const oldDeadline = task.deadline;
    const newDeadline = new Date(dto.newDeadline);

    if (isNaN(newDeadline.getTime())) {
      throw new BadRequestException('Invalid new deadline date');
    }

    task.deadlineHistory.push({
      oldDeadline,
      newDeadline,
      changedBy: actorId as any,
      changedAt: new Date(),
      reason: dto.reason.trim(),
    });

    task.deadline = newDeadline;
    const now = new Date();
    if (newDeadline > now) {
      task.isOverdue = false;
      if (task.status === TaskStatus.OVERDUE) {
        task.status = TaskStatus.IN_PROGRESS;
      }
    }
    await task.save();

    await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_DEADLINE_EXTENDED, {
      previousState: { deadline: oldDeadline },
      newState: { deadline: newDeadline },
      comment: `Deadline extended to ${newDeadline.toISOString()}: ${dto.reason.trim()}`,
      metadata: { oldDeadline, newDeadline, reason: dto.reason.trim() },
    });

    return { success: true, message: 'Deadline extended successfully', newDeadline };
  }

  // CANCEL TASK — see approveTask's comment on why this keeps a hardcoded
  // management-tier gate alongside the configurable permission.
  async cancelTask(id: string, dto: CancelTaskDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can cancel tasks');
    }

    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const actorId = this.getUserId(user);
    task.status = TaskStatus.CANCELLED;
    task.cancellationReason = dto.reason.trim();
    task.cancelledBy = actorId as any;
    task.cancelledAt = new Date();
    await task.save();

    await this.assigneeModel.updateMany(
      { task: id },
      { $set: { status: TaskStatus.CANCELLED, lastUpdateAt: new Date() } },
    );

    await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_CANCELLED, {
      newState: { status: TaskStatus.CANCELLED },
      comment: `Task cancelled: ${dto.reason.trim()}`,
    });

    return { success: true, message: 'Task cancelled successfully' };
  }

  // UPDATE TASK BASIC INFO (gated by the "tasks" edit permission at the controller level)
  async updateTask(id: string, dto: UpdateTaskDto, user: any) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    if (dto.title) task.title = dto.title.trim();
    if (dto.description) task.description = dto.description.trim();
    if (dto.instructionSource) task.instructionSource = dto.instructionSource;
    if (dto.instructionSourceCustom !== undefined) task.instructionSourceCustom = dto.instructionSourceCustom;
    if (dto.branch) task.branch = dto.branch.trim();
    if (dto.department) task.department = dto.department.trim();
    if (dto.category) task.category = dto.category.trim();
    if (dto.priority) task.priority = dto.priority;
    if (dto.approvalRequired !== undefined) task.approvalRequired = dto.approvalRequired;
    if (dto.completionProofRequired !== undefined) task.completionProofRequired = dto.completionProofRequired;
    if (dto.completionCondition) task.completionCondition = dto.completionCondition;
    if (dto.attachments) task.attachments = dto.attachments;
    if (dto.remarks) task.remarks = dto.remarks.trim();
    if (dto.relatedProject !== undefined) task.relatedProject = dto.relatedProject.trim();
    if (dto.estimatedEffort !== undefined) task.estimatedEffort = dto.estimatedEffort.trim();

    // If assignees were changed
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const existingAssignees = await this.assigneeModel.find({ task: id });
      const existingEmpIds = existingAssignees.map((a) => a.employee.toString());

      const toAdd = dto.assigneeIds.filter((empId) => !existingEmpIds.includes(empId));
      if (toAdd.length > 0) {
        const newDocs = toAdd.map((empId) => ({
          task: id,
          employee: empId,
          status: TaskStatus.PENDING,
          progress: 0,
        }));
        await this.assigneeModel.insertMany(newDocs);

        for (const empId of toAdd) {
          await this.logAuditEvent(id, user.id, TaskEventType.TASK_ASSIGNED, {
            targetEmployeeId: empId,
            comment: 'Added as assignee during task update',
          });
        }
      }
    }

    await task.save();

    await this.logAuditEvent(task._id, user.id, TaskEventType.TASK_UPDATED, {
      comment: 'Task details updated by management',
    });

    return this.findById(id, user);
  }

  // DELETE TASK (gated by the "tasks" delete permission at the controller level)
  async deleteTask(id: string) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    await Promise.all([
      this.taskModel.findByIdAndDelete(id),
      this.assigneeModel.deleteMany({ task: id }),
      this.auditLogModel.deleteMany({ task: id }),
      this.updateModel.deleteMany({ task: id }),
      this.reminderModel.deleteMany({ task: id }),
    ]);

    return { success: true, message: 'Task and related records deleted successfully' };
  }

  // DASHBOARD KPI METRICS
  async getDashboardStats(user?: any) {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [
      totalTasks,
      pendingTasks,
      inProgressTasks,
      waitingApprovalTasks,
      completedTasks,
      overdueTasks,
      criticalTasks,
      dueTodayTasks,
      dueSoonTasks,
      sourceBreakdown,
      recentActivity,
    ] = await Promise.all([
      this.taskModel.countDocuments(),
      this.taskModel.countDocuments({ status: TaskStatus.PENDING }),
      this.taskModel.countDocuments({ status: TaskStatus.IN_PROGRESS }),
      this.taskModel.countDocuments({ status: TaskStatus.WAITING_FOR_APPROVAL }),
      this.taskModel.countDocuments({ status: TaskStatus.COMPLETED }),
      this.taskModel.countDocuments({
        $or: [
          { status: TaskStatus.OVERDUE },
          { deadline: { $lt: now }, status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
        ],
      }),
      this.taskModel
        .find({
          priority: { $in: [TaskPriority.CRITICAL, TaskPriority.URGENT] },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        })
        .populate('issuedBy', 'name photo employeeId')
        .limit(5)
        .lean(),
      this.taskModel.countDocuments({
        deadline: { $gte: now, $lte: endOfDay },
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      }),
      this.taskModel.countDocuments({
        deadline: {
          $gt: endOfDay,
          $lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      }),
      this.taskModel.aggregate([
        {
          $group: {
            _id: '$instructionSource',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] },
            },
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
      this.auditLogModel
        .find()
        .populate('actor', 'name photo employeeId')
        .populate('task', 'title instructionSource priority')
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
    ]);

    return {
      overview: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        waitingApproval: waitingApprovalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        dueSoon: dueSoonTasks,
      },
      criticalTasks,
      sourceBreakdown,
      recentActivity,
    };
  }

  // MANAGEMENT FOLLOW-UP VIEW
  async getFollowUpList(query: any) {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const followUpFilter: any = {
      $or: [
        // Overdue tasks
        {
          deadline: { $lt: now },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
        // Due today
        {
          deadline: { $gte: now, $lte: endOfDay },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
        // Waiting for approval
        { status: TaskStatus.WAITING_FOR_APPROVAL },
        // Critical or Urgent pending
        {
          priority: { $in: [TaskPriority.CRITICAL, TaskPriority.URGENT] },
          status: TaskStatus.PENDING,
        },
      ],
    };

    const tasks = await this.taskModel
      .find(followUpFilter)
      .populate('issuedBy', 'name photo employeeId')
      .sort({ priority: -1, deadline: 1 })
      .lean();

    const taskIds = tasks.map((t) => t._id);
    const assignees = await this.assigneeModel
      .find({ task: { $in: taskIds } })
      .populate('employee', 'name photo employeeId department branch')
      .lean();

    const assigneeMap = new Map<string, any[]>();
    assignees.forEach((a) => {
      const tId = a.task.toString();
      if (!assigneeMap.has(tId)) assigneeMap.set(tId, []);
      assigneeMap.get(tId)?.push(a);
    });

    return tasks.map((t) => ({
      ...t,
      assignees: assigneeMap.get(t._id.toString()) || [],
      isOverdue: new Date(t.deadline) < now && t.status !== TaskStatus.COMPLETED,
    }));
  }

  // SOURCE-WISE, BRANCH-WISE, AND EMPLOYEE PERFORMANCE REPORTS
  async getReports(type: string, query: any) {
    const now = new Date();
    const branch = query?.branch ? String(query.branch).trim() : null;
    const hasBranchFilter = !!(branch && branch !== 'all' && branch !== 'All Branches');

    if (type === 'source-wise') {
      const pipeline: any[] = [];
      if (hasBranchFilter) {
        pipeline.push({
          $match: {
            $or: [
              { branch: { $regex: new RegExp(`^${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
              { branch: 'All Branches' },
            ],
          },
        });
      }
      pipeline.push(
        {
          $group: {
            _id: '$instructionSource',
            totalTasks: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.PENDING] }, 1, 0] },
            },
            waitingApproval: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.WAITING_FOR_APPROVAL] }, 1, 0] },
            },
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
        { $sort: { totalTasks: -1 } },
      );

      const breakdown = await this.taskModel.aggregate(pipeline);

      return breakdown.map((item) => ({
        source: item._id,
        totalTasks: item.totalTasks,
        completed: item.completed,
        inProgress: item.inProgress,
        pending: item.pending,
        waitingApproval: item.waitingApproval,
        overdue: item.overdue,
        completionRate: item.totalTasks > 0 ? Math.round((item.completed / item.totalTasks) * 100) : 0,
      }));
    }

    if (type === 'branch-wise') {
      const pipeline: any[] = [];
      if (hasBranchFilter) {
        pipeline.push({
          $match: {
            branch: { $regex: new RegExp(`^${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          },
        });
      }
      pipeline.push(
        {
          $group: {
            _id: '$branch',
            totalTasks: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.PENDING] }, 1, 0] },
            },
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
        { $sort: { totalTasks: -1 } },
      );

      const breakdown = await this.taskModel.aggregate(pipeline);

      return breakdown.map((item) => ({
        branch: item._id || 'All Branches',
        totalTasks: item.totalTasks,
        completed: item.completed,
        inProgress: item.inProgress,
        pending: item.pending,
        overdue: item.overdue,
        completionRate: item.totalTasks > 0 ? Math.round((item.completed / item.totalTasks) * 100) : 0,
      }));
    }

    if (type === 'employee-wise') {
      const pipeline: any[] = [
        {
          $lookup: {
            from: 'tasks',
            localField: 'task',
            foreignField: '_id',
            as: 'taskInfo',
          },
        },
        { $unwind: '$taskInfo' },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'empInfo',
          },
        },
        { $unwind: '$empInfo' },
      ];

      if (hasBranchFilter) {
        const branchRegex = new RegExp(`^${branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        pipeline.push({
          $match: {
            $or: [
              { 'empInfo.branch': { $regex: branchRegex } },
              {
                $and: [
                  { $or: [{ 'empInfo.branch': { $exists: false } }, { 'empInfo.branch': null }, { 'empInfo.branch': '' }, { 'empInfo.branch': 'N/A' }] },
                  { 'taskInfo.branch': { $regex: branchRegex } },
                ],
              },
            ],
          },
        });
      }

      pipeline.push(
        {
          $group: {
            _id: '$empInfo._id',
            name: { $first: '$empInfo.name' },
            employeeId: { $first: '$empInfo.employeeId' },
            department: { $first: '$empInfo.department' },
            branch: { $first: '$empInfo.branch' },
            totalTasks: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.PENDING] }, 1, 0] },
            },
            waitingApproval: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.WAITING_FOR_APPROVAL] }, 1, 0] },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', TaskStatus.COMPLETED] },
                      { $ne: ['$status', TaskStatus.CANCELLED] },
                      { $lt: ['$taskInfo.deadline', now] },
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
        { $limit: 100 },
      );

      const breakdown = await this.assigneeModel.aggregate(pipeline);

      return breakdown.map((item) => ({
        employeeId: item.employeeId || 'N/A',
        name: item.name,
        department: item.department || 'N/A',
        branch: item.branch || 'N/A',
        totalTasks: item.totalTasks,
        completed: item.completed,
        inProgress: item.inProgress,
        pending: item.pending,
        waitingApproval: item.waitingApproval,
        overdue: item.overdue,
        completionRate: item.totalTasks > 0 ? Math.round((item.completed / item.totalTasks) * 100) : 0,
      }));
    }

    throw new BadRequestException(`Unknown report type: ${type}`);
  }

  // CALENDAR TASKS
  async getCalendarTasks(month?: number, year?: number, user?: any) {
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month !== undefined ? month : new Date().getMonth();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const filter: any = {
      $or: [
        { deadline: { $gte: startOfMonth, $lte: endOfMonth } },
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
      ],
    };

    const isManager = this.isManagerOrAdmin(user?.role);
    if (!isManager && user) {
      const userId = this.getUserId(user);
      const myAssignments = await this.assigneeModel
        .find({ employee: userId })
        .select('task');
      filter._id = { $in: myAssignments.map((a) => a.task) };
    }

    const tasks = await this.taskModel
      .find(filter)
      .select('title priority status deadline startDate instructionSource progress')
      .lean();

    return tasks;
  }

  // LIVE ALERTS FOR HEADER BELL
  async getAlerts(user: any) {
    const now = new Date();
    const isManager = this.isManagerOrAdmin(user?.role);

    const alerts: any = {
      overdue: [],
      waitingApproval: [],
      dueSoon: [],
      newAssigned: [],
    };

    if (isManager) {
      // Management sees tasks waiting for approval and critical overdue
      alerts.waitingApproval = await this.taskModel
        .find({ status: TaskStatus.WAITING_FOR_APPROVAL })
        .select('title priority instructionSource deadline updatedAt')
        .limit(5)
        .lean();

      alerts.overdue = await this.taskModel
        .find({
          deadline: { $lt: now },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        })
        .select('title priority instructionSource deadline')
        .limit(5)
        .lean();
    }

    if (user) {
      const userId = this.getUserId(user);
      // Employee sees their own overdue, due soon, and newly assigned tasks
      const myAssignees = await this.assigneeModel
        .find({
          employee: userId,
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        })
        .populate('task', 'title priority instructionSource deadline status')
        .lean();

      for (const a of myAssignees) {
        const t = a.task as any;
        if (!t) continue;
        const deadline = new Date(t.deadline);
        if (deadline < now) {
          alerts.overdue.push(t);
        } else if (deadline.getTime() - now.getTime() <= 2 * 24 * 60 * 60 * 1000) {
          alerts.dueSoon.push(t);
        }
        if (a.status === TaskStatus.PENDING) {
          alerts.newAssigned.push(t);
        }
      }
    }

    return alerts;
  }

  // CATEGORY MANAGEMENT
  async getCategories() {
    return this.categoryModel.find().sort({ order: 1, name: 1 });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.categoryModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new BadRequestException(`Category "${dto.name}" already exists`);
    }

    return this.categoryModel.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      order: dto.order || 99,
      status: dto.status || 'active',
      isSystem: false,
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Task category not found');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const existing = await this.categoryModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Category "${dto.name}" already exists`);
      }
      category.name = dto.name.trim();
    }
    if (dto.description !== undefined) category.description = dto.description.trim();
    if (dto.order !== undefined) category.order = dto.order;
    if (dto.status) category.status = dto.status;

    return category.save();
  }

  async deleteCategory(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Task category not found');
    }

    const inUse = await this.taskModel.countDocuments({ category: category.name });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete "${category.name}" — it is currently used by ${inUse} task${inUse > 1 ? 's' : ''}`,
      );
    }

    await this.categoryModel.findByIdAndDelete(id);
    return { message: 'Task category deleted successfully' };
  }

  // EMPLOYEE PERFORMANCE & TASK HISTORY ANALYTICS (Requirements 8 & 9)
  async getEmployeePerformance(employeeId: string, query: any) {
    let employeeDoc: any = null;
    if (Types.ObjectId.isValid(employeeId)) {
      employeeDoc = await this.employeeModel
        .findById(employeeId)
        .select('name email employeeId designation department branch photo role')
        .lean();
    }
    if (!employeeDoc) {
      employeeDoc = await this.employeeModel
        .findOne({ employeeId })
        .select('name email employeeId designation department branch photo role')
        .lean();
    }
    if (!employeeDoc) {
      throw new NotFoundException(`Employee with ID "${employeeId}" not found`);
    }

    const empObjId = employeeDoc._id;
    const assignments = await this.assigneeModel
      .find({ employee: empObjId })
      .populate({
        path: 'task',
        populate: [
          { path: 'issuedBy', select: 'name email employeeId role' },
          { path: 'createdBy', select: 'name email' },
        ],
      })
      .populate('approvedBy', 'name email employeeId')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    let totalAssigned = assignments.length;
    let completedCount = 0;
    let pendingCount = 0;
    let inProgressCount = 0;
    let submittedCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let ratingSum = 0;
    let ratedCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let totalRankSum = 0;
    let rankedCount = 0;
    let totalDurationDaysSum = 0;
    let durationCount = 0;

    const taskHistory = assignments
      .filter((a) => a.task)
      .map((a) => {
        const t = a.task as any;
        const isDone = a.status === TaskStatus.COMPLETED || a.status === TaskStatus.APPROVED;
        const isSub =
          a.status === TaskStatus.SUBMITTED ||
          a.status === TaskStatus.WAITING_FOR_APPROVAL ||
          a.status === TaskStatus.UNDER_REVIEW;
        const isRej = a.status === TaskStatus.REJECTED || !!a.rejectionReason;

        if (isDone) {
          completedCount++;
          approvedCount++;
        } else if (isSub) {
          submittedCount++;
        } else if (a.status === TaskStatus.IN_PROGRESS) {
          inProgressCount++;
        } else {
          pendingCount++;
        }

        if (isRej) rejectedCount++;

        if (a.rating !== undefined && a.rating !== null) {
          ratingSum += Number(a.rating);
          ratedCount++;
        }

        if (a.submissionRank) {
          totalRankSum += a.submissionRank;
          rankedCount++;
        }

        // On-time evaluation
        const deadlineDate = new Date(t.deadline);
        let isOnTime = false;
        let isLate = false;
        if (a.completedAt) {
          isOnTime = new Date(a.completedAt) <= deadlineDate;
          isLate = !isOnTime;
        } else if (a.submittedAt) {
          isOnTime = new Date(a.submittedAt) <= deadlineDate;
          isLate = !isOnTime;
        } else if (now > deadlineDate && !isDone) {
          isLate = true;
        } else {
          isOnTime = true;
        }

        if (isOnTime) onTimeCount++;
        if (isLate) lateCount++;

        // Duration calculation
        if (a.completedAt && a.startedAt) {
          const durMs = new Date(a.completedAt).getTime() - new Date(a.startedAt).getTime();
          const durDays = Math.max(0, Math.round(durMs / (1000 * 60 * 60 * 24)));
          totalDurationDaysSum += durDays;
          durationCount++;
        }

        return {
          _id: a._id,
          taskId: t._id,
          taskTitle: t.title,
          taskDescription: t.description,
          instructionSource: t.instructionSource,
          category: t.category,
          priority: t.priority,
          assignedDate: (a as any).createdAt,
          startDate: a.startedAt,
          deadline: t.deadline,
          submittedDate: a.submittedAt,
          completedDate: a.completedAt,
          approvalDate: a.approvedAt,
          approvedBy: a.approvedBy,
          status: a.status,
          progress: a.progress,
          workQualityRating: a.rating,
          approvalComment: a.approvalComment,
          rejectionReason: a.rejectionReason,
          submissionRank: a.submissionRank,
          isOnTime,
          isLate,
          proofsCount: a.proofs?.length || 0,
          proofs: a.proofs || [],
        };
      });

    const averageRating = ratedCount > 0 ? Math.round(ratingSum / ratedCount) : 0;
    const onTimePercentage = totalAssigned > 0 ? Math.round((onTimeCount / totalAssigned) * 100) : 0;
    const latePercentage = Math.max(0, 100 - onTimePercentage);
    const averageSubmissionRank =
      rankedCount > 0 ? Number((totalRankSum / rankedCount).toFixed(1)) : 1.0;
    const averageCompletionDays =
      durationCount > 0 ? Number((totalDurationDaysSum / durationCount).toFixed(1)) : 0;

    return {
      employee: employeeDoc,
      summary: {
        totalAssigned,
        completedCount,
        pendingCount,
        inProgressCount,
        submittedCount,
        approvedCount,
        rejectedCount,
        averageRating,
        ratedCount,
        onTimeCount,
        lateCount,
        onTimePercentage,
        latePercentage,
        averageSubmissionRank,
        averageCompletionDays,
      },
      taskHistory,
    };
  }

  // SUBTASK MANAGEMENT (Requirement 1)
  async addSubtask(taskId: string, dto: SubtaskItemDto, user: any) {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    const actorId = this.getUserId(user);
    const subtask: any = {
      _id: new Types.ObjectId(),
      title: dto.title.trim(),
      description: dto.description?.trim(),
      assignees: (dto.assigneeIds || []).map((id) => new Types.ObjectId(id)),
      priority: dto.priority || task.priority || TaskPriority.MEDIUM,
      deadline: dto.deadline ? new Date(dto.deadline) : task.deadline,
      status: TaskStatus.PENDING,
      progress: 0,
      approvalRequired: dto.approvalRequired ?? task.approvalRequired ?? false,
      completionProofRequired: dto.completionProofRequired ?? task.completionProofRequired ?? false,
      proofs: [],
    };

    if (!task.items) task.items = [];
    task.items.push(subtask);
    await task.save();

    // Ensure assignees have a TaskAssignee document
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      for (const empId of dto.assigneeIds) {
        const existing = await this.assigneeModel.findOne({ task: taskId, employee: empId });
        if (!existing) {
          await this.assigneeModel.create({
            task: taskId,
            employee: empId,
            status: TaskStatus.PENDING,
            progress: 0,
            taskItemId: subtask._id.toString(),
          });
        }
      }
    }

    await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_UPDATED, {
      comment: `Added subtask item: "${subtask.title}"`,
    });

    return { success: true, message: 'Subtask added successfully', subtask };
  }

  async updateSubtask(taskId: string, subtaskId: string, dto: SubtaskItemDto, user: any) {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    const item = task.items?.find((i) => i._id.toString() === subtaskId);
    if (!item) throw new NotFoundException('Subtask item not found');

    if (dto.title) item.title = dto.title.trim();
    if (dto.description !== undefined) item.description = dto.description.trim();
    if (dto.priority) item.priority = dto.priority;
    if (dto.deadline) item.deadline = new Date(dto.deadline);
    if (dto.assigneeIds) {
      item.assignees = dto.assigneeIds.map((id) => new Types.ObjectId(id)) as any;
    }
    if (dto.approvalRequired !== undefined) item.approvalRequired = dto.approvalRequired;
    if (dto.completionProofRequired !== undefined)
      item.completionProofRequired = dto.completionProofRequired;

    await task.save();

    const actorId = this.getUserId(user);
    await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_UPDATED, {
      comment: `Updated subtask item: "${item.title}"`,
    });

    return { success: true, message: 'Subtask updated successfully', subtask: item };
  }

  async deleteSubtask(taskId: string, subtaskId: string, user: any) {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    task.items = (task.items || []).filter((i) => i._id.toString() !== subtaskId);
    await task.save();

    const actorId = this.getUserId(user);
    await this.logAuditEvent(task._id, actorId, TaskEventType.TASK_UPDATED, {
      comment: `Deleted subtask item ID: ${subtaskId}`,
    });

    return { success: true, message: 'Subtask removed successfully' };
  }
}
