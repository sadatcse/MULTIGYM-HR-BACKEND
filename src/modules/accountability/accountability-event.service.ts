import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CommunicationEvent,
  CommunicationEventDocument,
  CommunicationType,
  AccountabilityEventType,
} from './schemas/communication-event.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { Notice, NoticeDocument } from '../notice/schemas/notice.schema';
import { Task, TaskDocument } from '../task/schemas/task.schema';
import { TaskAssignee, TaskAssigneeDocument } from '../task/schemas/task-assignee.schema';
import { NoticeRecipient, NoticeRecipientDocument } from '../notice/schemas/notice-recipient.schema';

@Injectable()
export class AccountabilityEventService {
  private readonly logger = new Logger(AccountabilityEventService.name);

  constructor(
    @InjectModel(CommunicationEvent.name)
    private readonly eventModel: Model<CommunicationEventDocument>,
    @InjectModel(Notice.name)
    private readonly noticeModel: Model<NoticeDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(NoticeRecipient.name)
    private readonly recipientModel: Model<NoticeRecipientDocument>,
    @InjectModel(TaskAssignee.name)
    private readonly assigneeModel: Model<TaskAssigneeDocument>,
    @Optional()
    private readonly chatGateway?: ChatGateway,
  ) {}

  // Record an immutable event
  async recordEvent(params: {
    communicationId: string | Types.ObjectId;
    communicationType: CommunicationType;
    title: string;
    source?: string;
    eventType: AccountabilityEventType;
    actor: string | Types.ObjectId;
    targetUser?: string | Types.ObjectId;
    branch?: string;
    department?: string;
    previousStatus?: string;
    newStatus?: string;
    metadata?: Record<string, any>;
    comment?: string;
    timestamp?: Date;
  }): Promise<CommunicationEventDocument> {
    const doc = new this.eventModel({
      communicationId: new Types.ObjectId(params.communicationId.toString()),
      communicationType: params.communicationType,
      title: params.title.trim(),
      source: params.source || 'Management',
      eventType: params.eventType,
      actor: new Types.ObjectId(params.actor.toString()),
      targetUser: params.targetUser ? new Types.ObjectId(params.targetUser.toString()) : undefined,
      branch: params.branch || 'All Branches',
      department: params.department || 'All Departments',
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      metadata: params.metadata || {},
      comment: params.comment?.trim(),
      timestamp: params.timestamp || new Date(),
    });

    const saved = await doc.save();

    // Broadcast live event via websocket if gateway is available
    try {
      this.chatGateway?.server?.emit('accountability_event', {
        id: saved._id,
        communicationId: saved.communicationId,
        communicationType: saved.communicationType,
        eventType: saved.eventType,
        title: saved.title,
        source: saved.source,
        timestamp: saved.timestamp,
        comment: saved.comment,
      });
    } catch {
      // Socket broadcast failure shouldn't disrupt transaction
    }

    return saved;
  }

  // Get paginated activity stream
  async getActivityStream(query: any, user?: any): Promise<any> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.type) filter.communicationType = query.type;
    if (query.source) filter.source = query.source;
    if (query.branch && query.branch !== 'All Branches') filter.branch = query.branch;
    if (query.department && query.department !== 'All Departments') filter.department = query.department;

    const [events, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .populate('actor', 'name employeeId role photo email')
        .populate('targetUser', 'name employeeId role photo')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get unified chronological timeline for a specific communication
  async getTimeline(type: string, id: string): Promise<any> {
    const commId = new Types.ObjectId(id);

    const events = await this.eventModel
      .find({ communicationId: commId })
      .populate('actor', 'name employeeId role photo')
      .populate('targetUser', 'name employeeId role photo')
      .sort({ timestamp: 1 })
      .lean();

    return events;
  }

  // Sync historical records if event ledger is empty
  async syncHistoricalDataIfEmpty(): Promise<number> {
    const count = await this.eventModel.countDocuments();
    if (count > 0) return 0;

    this.logger.log('Synchronizing historical Notice and Task records into Unified Event Ledger...');
    let synced = 0;

    // 1. Sync Notices
    const notices = await this.noticeModel.find().lean();
    for (const n of notices) {
      await this.recordEvent({
        communicationId: n._id,
        communicationType: CommunicationType.NOTICE,
        title: n.title,
        source: 'Admin & HR',
        eventType: AccountabilityEventType.COMMUNICATION_CREATED,
        actor: (n as any).createdBy || n._id,
        branch: Array.isArray((n as any).targetBranches) ? (n as any).targetBranches.join(', ') : ((n as any).targetBranches || 'All Branches'),
        department: Array.isArray((n as any).targetDepartments) ? (n as any).targetDepartments.join(', ') : ((n as any).targetDepartments || 'All Departments'),
        newStatus: n.status,
        timestamp: (n as any).createdAt || new Date(),
        comment: 'Notice published',
      });
      synced++;
    }

    // 2. Sync Tasks
    const tasks = await this.taskModel.find().lean();
    for (const t of tasks) {
      await this.recordEvent({
        communicationId: t._id,
        communicationType: (t.instructionSource === 'MD Sir' || t.instructionSource === 'Director Sir')
          ? CommunicationType.INSTRUCTION
          : CommunicationType.TASK,
        title: t.title,
        source: t.instructionSource || 'Management',
        eventType: AccountabilityEventType.COMMUNICATION_CREATED,
        actor: t.createdBy as any,
        branch: t.branch,
        department: t.department,
        newStatus: t.status,
        timestamp: (t as any).createdAt || new Date(),
        comment: `Task created from source "${t.instructionSource}"`,
      });
      synced++;
    }

    this.logger.log(`Historical sync completed. ${synced} accountability events created.`);
    return synced;
  }
}
