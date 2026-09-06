import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notice, NoticeDocument, NoticeStatus, TargetType } from './schemas/notice.schema';
import { NoticeRecipient, NoticeRecipientDocument, RecipientStatus } from './schemas/notice-recipient.schema';
import { NoticeAuditLog, NoticeAuditLogDocument, NoticeEventType } from './schemas/notice-audit-log.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

// Same hardcoded floor as task.service.ts / maintenance.service.ts: none of
// the "admin/*" notice endpoints have a configured role-permission entry for
// ANY role (checked live — even ADMIN/SUPER ADMIN have none), so
// PermissionsGuard's "unconfigured = allow" default currently lets any
// authenticated employee publish, edit, delete, or blast reminders for
// company-wide notices. This closes that the same way Task/Maintenance's
// approve/reject actions were closed.
const ADMIN_ROLES = ['SUPERADMIN', 'SUPER ADMIN', 'ADMIN', 'DIRECTOR', 'MANAGER', 'MD'];

@Injectable()
export class NoticeService {
  constructor(
    @InjectModel(Notice.name) private readonly noticeModel: Model<NoticeDocument>,
    @InjectModel(NoticeRecipient.name) private readonly recipientModel: Model<NoticeRecipientDocument>,
    @InjectModel(NoticeAuditLog.name) private readonly auditLogModel: Model<NoticeAuditLogDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  private isManagerOrAdmin(role?: string): boolean {
    if (!role) return false;
    return ADMIN_ROLES.includes(role.toUpperCase());
  }

  // Log Audit Event helper
  private async logAuditEvent(
    noticeId: string | Types.ObjectId,
    actorId: string | Types.ObjectId,
    eventType: NoticeEventType,
    employeeId?: string | Types.ObjectId,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.auditLogModel.create({
        notice: new Types.ObjectId(noticeId.toString()),
        actor: new Types.ObjectId(actorId.toString()),
        employee: employeeId ? new Types.ObjectId(employeeId.toString()) : undefined,
        eventType,
        metadata,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Failed to log audit event:', err);
    }
  }

  // Create Notice
  async createNotice(dto: CreateNoticeDto, user: any): Promise<Notice> {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can create notices');
    }

    const actorId = user._id || user.id || user.sub;

    const notice = new this.noticeModel({
      ...dto,
      createdBy: new Types.ObjectId(actorId),
      status: dto.autoPublish ? NoticeStatus.PUBLISHED : NoticeStatus.DRAFT,
      publishedAt: dto.autoPublish ? new Date() : undefined,
      version: 1,
    });

    const savedNotice = await notice.save();

    await this.logAuditEvent(savedNotice._id, actorId, NoticeEventType.NOTICE_CREATED, undefined, {
      title: savedNotice.title,
      category: savedNotice.category,
      priority: savedNotice.priority,
    });

    if (dto.autoPublish) {
      await this.publishNotice(savedNotice._id.toString(), user);
    }

    return savedNotice;
  }

  // Update Notice
  async updateNotice(id: string, dto: UpdateNoticeDto, user: any): Promise<Notice> {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can edit notices');
    }

    const actorId = user._id || user.id || user.sub;
    const notice = await this.noticeModel.findById(id);
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    if (dto.isMajorUpdate && notice.status === NoticeStatus.PUBLISHED) {
      notice.version = (notice.version || 1) + 1;
    }

    Object.assign(notice, dto);
    const updatedNotice = await notice.save();

    await this.logAuditEvent(updatedNotice._id, actorId, NoticeEventType.NOTICE_UPDATED, undefined, {
      version: updatedNotice.version,
      isMajorUpdate: dto.isMajorUpdate,
    });

    return updatedNotice;
  }

  // Publish Notice & Resolve Target Recipients
  async publishNotice(id: string, user: any): Promise<Notice> {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can publish notices');
    }

    const actorId = user._id || user.id || user.sub;
    const notice = await this.noticeModel.findById(id);
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    notice.status = NoticeStatus.PUBLISHED;
    notice.publishedAt = new Date();
    await notice.save();

    // Resolve Target Recipients
    let recipientQuery: any = { status: 'active' };

    if (notice.targetType === TargetType.DEPARTMENT && notice.targetDepartments?.length > 0) {
      recipientQuery.department = { $in: notice.targetDepartments };
    } else if (notice.targetType === TargetType.DESIGNATION && notice.targetDesignations?.length > 0) {
      recipientQuery.jobPosition = { $in: notice.targetDesignations };
    } else if (notice.targetType === TargetType.BRANCH && notice.targetBranches?.length > 0) {
      recipientQuery.branches = { $in: notice.targetBranches };
    } else if (notice.targetType === TargetType.EMPLOYEES && notice.targetEmployees?.length > 0) {
      const employeeIds = notice.targetEmployees.map((e) => new Types.ObjectId(e.toString()));
      recipientQuery._id = { $in: employeeIds };
    }

    const eligibleEmployees = await this.employeeModel.find(recipientQuery).select('_id').exec();

    // Bulk Upsert NoticeRecipient Records
    const bulkOps = eligibleEmployees.map((emp) => ({
      updateOne: {
        filter: { notice: notice._id, employee: emp._id },
        update: {
          $setOnInsert: {
            notice: notice._id,
            employee: emp._id,
            status: RecipientStatus.DELIVERED,
            deliveredAt: new Date(),
            viewCount: 0,
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.recipientModel.bulkWrite(bulkOps);
    }

    await this.logAuditEvent(notice._id, actorId, NoticeEventType.NOTICE_PUBLISHED, undefined, {
      recipientCount: eligibleEmployees.length,
      targetType: notice.targetType,
    });

    return notice;
  }

  // Employee: Fetch My Notices
  async getMyNotices(user: any): Promise<any> {
    const employeeId = user._id || user.id || user.sub;

    const recipients = await this.recipientModel
      .find({ employee: new Types.ObjectId(employeeId) })
      .populate({
        path: 'notice',
        populate: { path: 'createdBy', select: 'name email jobPosition photo' },
      })
      .sort({ createdAt: -1 })
      .exec();

    // Filter out unpublished or missing notices
    const validRecipients = recipients.filter((r) => r.notice && (r.notice as any).status === NoticeStatus.PUBLISHED);

    const now = new Date();

    const formattedNotices = validRecipients.map((r) => {
      const n: any = r.notice;
      const isExpired = n.expiresAt ? new Date(n.expiresAt) < now : false;
      const isPastDeadline = n.acknowledgementDeadline ? new Date(n.acknowledgementDeadline) < now : false;

      return {
        recipientId: r._id,
        noticeId: n._id,
        title: n.title,
        content: n.content,
        category: n.category,
        priority: n.priority,
        attachments: n.attachments || [],
        requiresAcknowledgement: n.requiresAcknowledgement,
        acknowledgementDeadline: n.acknowledgementDeadline,
        allowDownload: n.allowDownload,
        version: n.version,
        publishedAt: n.publishedAt || n.createdAt,
        expiresAt: n.expiresAt,
        author: n.createdBy ? { name: n.createdBy.name, title: n.createdBy.jobPosition || 'HR Admin' } : { name: 'Management' },
        // Recipient Specific State
        deliveryStatus: r.status,
        deliveredAt: r.deliveredAt,
        firstSeenAt: r.firstSeenAt,
        lastSeenAt: r.lastSeenAt,
        viewCount: r.viewCount,
        acknowledgedAt: r.acknowledgedAt,
        acknowledgedVersion: r.acknowledgedVersion,
        isSeen: !!r.firstSeenAt,
        isAcknowledged: r.status === RecipientStatus.ACKNOWLEDGED || r.status === RecipientStatus.ACKNOWLEDGED_LATE,
        isExpired,
        isPastDeadline,
      };
    });

    const unreadCount = formattedNotices.filter((n) => !n.isSeen).length;
    const pendingAckCount = formattedNotices.filter((n) => n.requiresAcknowledgement && !n.isAcknowledged).length;

    return {
      notices: formattedNotices,
      stats: {
        total: formattedNotices.length,
        unread: unreadCount,
        pendingAck: pendingAckCount,
      },
    };
  }

  // Employee: Record Seen Event
  async recordSeen(noticeId: string, user: any, ipAddress?: string, userAgent?: string): Promise<any> {
    const employeeId = user._id || user.id || user.sub;

    let recipient = await this.recipientModel.findOne({
      notice: new Types.ObjectId(noticeId),
      employee: new Types.ObjectId(employeeId),
    });

    if (!recipient) {
      // Check if notice exists and is published
      const notice = await this.noticeModel.findById(noticeId);
      if (!notice || notice.status !== NoticeStatus.PUBLISHED) {
        throw new NotFoundException('Notice not found or not published');
      }
      // Create recipient dynamically
      recipient = await this.recipientModel.create({
        notice: new Types.ObjectId(noticeId),
        employee: new Types.ObjectId(employeeId),
        status: RecipientStatus.DELIVERED,
        deliveredAt: new Date(),
        viewCount: 0,
      });
    }

    const isFirstTime = !recipient.firstSeenAt;

    if (isFirstTime) {
      recipient.firstSeenAt = new Date();
      if (recipient.status === RecipientStatus.DELIVERED) {
        recipient.status = RecipientStatus.SEEN;
      }
    }

    recipient.lastSeenAt = new Date();
    recipient.viewCount = (recipient.viewCount || 0) + 1;
    if (ipAddress) recipient.ipAddress = ipAddress;
    if (userAgent) recipient.userAgent = userAgent;

    await recipient.save();

    if (isFirstTime) {
      await this.logAuditEvent(noticeId, employeeId, NoticeEventType.NOTICE_SEEN, employeeId, {
        firstSeenAt: recipient.firstSeenAt,
        ipAddress,
      });
    }

    return {
      success: true,
      firstSeenAt: recipient.firstSeenAt,
      lastSeenAt: recipient.lastSeenAt,
      viewCount: recipient.viewCount,
      status: recipient.status,
    };
  }

  // Employee: Record Acknowledgement Event
  async recordAcknowledgement(noticeId: string, user: any): Promise<any> {
    const employeeId = user._id || user.id || user.sub;

    const notice = await this.noticeModel.findById(noticeId);
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    if (!notice.requiresAcknowledgement) {
      throw new BadRequestException('This notice does not require acknowledgement');
    }

    const recipient = await this.recipientModel.findOne({
      notice: new Types.ObjectId(noticeId),
      employee: new Types.ObjectId(employeeId),
    });

    if (!recipient) {
      throw new NotFoundException('Notice recipient record not found');
    }

    if (recipient.status === RecipientStatus.ACKNOWLEDGED || recipient.status === RecipientStatus.ACKNOWLEDGED_LATE) {
      return {
        alreadyAcknowledged: true,
        acknowledgedAt: recipient.acknowledgedAt,
        status: recipient.status,
      };
    }

    const now = new Date();
    const isLate = notice.acknowledgementDeadline && new Date(notice.acknowledgementDeadline) < now;

    recipient.status = isLate ? RecipientStatus.ACKNOWLEDGED_LATE : RecipientStatus.ACKNOWLEDGED;
    recipient.acknowledgedAt = now;
    recipient.acknowledgedVersion = notice.version || 1;

    if (!recipient.firstSeenAt) {
      recipient.firstSeenAt = now;
    }
    recipient.lastSeenAt = now;

    await recipient.save();

    await this.logAuditEvent(noticeId, employeeId, NoticeEventType.NOTICE_ACKNOWLEDGED, employeeId, {
      acknowledgedAt: now,
      version: recipient.acknowledgedVersion,
      isLate,
    });

    return {
      success: true,
      acknowledgedAt: recipient.acknowledgedAt,
      status: recipient.status,
      isLate,
    };
  }

  // Admin: Get Dashboard KPI Stats & Stream
  async getAdminDashboardStats(): Promise<any> {
    const totalNotices = await this.noticeModel.countDocuments();
    const publishedCount = await this.noticeModel.countDocuments({ status: NoticeStatus.PUBLISHED });
    const draftCount = await this.noticeModel.countDocuments({ status: NoticeStatus.DRAFT });
    const archivedCount = await this.noticeModel.countDocuments({ status: NoticeStatus.ARCHIVED });

    const recipientStats = await this.recipientModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts: Record<string, number> = {
      delivered: 0,
      seen: 0,
      acknowledged: 0,
      acknowledged_late: 0,
    };

    recipientStats.forEach((s) => {
      if (s._id) statusCounts[s._id] = s.count;
    });

    const totalRecipients = await this.recipientModel.countDocuments();
    const totalSeen = (statusCounts.seen || 0) + (statusCounts.acknowledged || 0) + (statusCounts.acknowledged_late || 0);
    const totalAck = (statusCounts.acknowledged || 0) + (statusCounts.acknowledged_late || 0);

    const recentActivity = await this.auditLogModel
      .find()
      .populate('notice', 'title category priority')
      .populate('actor', 'name employeeId photo')
      .populate('employee', 'name employeeId')
      .sort({ timestamp: -1 })
      .limit(15)
      .exec();

    return {
      kpis: {
        totalNotices,
        publishedCount,
        draftCount,
        archivedCount,
        totalRecipients,
        totalSeen,
        totalUnseen: Math.max(0, totalRecipients - totalSeen),
        totalAck,
        totalPendingAck: Math.max(0, totalRecipients - totalAck),
        seenPercentage: totalRecipients > 0 ? ((totalSeen / totalRecipients) * 100).toFixed(1) : '0',
        ackPercentage: totalRecipients > 0 ? ((totalAck / totalRecipients) * 100).toFixed(1) : '0',
      },
      recentActivity,
    };
  }

  // Admin: Get Notice Monitoring Page & Recipient Matrix
  async getNoticeMonitoring(id: string, search?: string, statusFilter?: string): Promise<any> {
    const notice = await this.noticeModel.findById(id).populate('createdBy', 'name email jobPosition').exec();
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    // 1. Compute true, global notice metrics across ALL recipients
    const allNoticeRecipients = await this.recipientModel.find({ notice: new Types.ObjectId(id) }).lean().exec();
    const totalRecipients = allNoticeRecipients.length;
    const seenCount = allNoticeRecipients.filter(
      (r) => !!r.firstSeenAt || r.status === RecipientStatus.SEEN || r.status === RecipientStatus.ACKNOWLEDGED || r.status === RecipientStatus.ACKNOWLEDGED_LATE,
    ).length;
    const unseenCount = Math.max(0, totalRecipients - seenCount);
    const ackCount = allNoticeRecipients.filter(
      (r) => r.status === RecipientStatus.ACKNOWLEDGED || r.status === RecipientStatus.ACKNOWLEDGED_LATE,
    ).length;
    const pendingAckCount = notice.requiresAcknowledgement ? Math.max(0, totalRecipients - ackCount) : 0;

    // 2. Query filtered recipients for the table display
    let recipientMatch: any = { notice: new Types.ObjectId(id) };

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'unseen') {
        recipientMatch.$and = [
          { status: RecipientStatus.DELIVERED },
          { $or: [{ firstSeenAt: { $exists: false } }, { firstSeenAt: null }] },
        ];
      } else if (statusFilter === 'seen') {
        recipientMatch.$or = [
          { firstSeenAt: { $exists: true, $ne: null } },
          { status: { $in: [RecipientStatus.SEEN, RecipientStatus.ACKNOWLEDGED, RecipientStatus.ACKNOWLEDGED_LATE] } },
        ];
      } else if (statusFilter === 'pending_ack') {
        recipientMatch.status = { $in: [RecipientStatus.DELIVERED, RecipientStatus.SEEN] };
      } else if (statusFilter === 'acknowledged') {
        recipientMatch.status = { $in: [RecipientStatus.ACKNOWLEDGED, RecipientStatus.ACKNOWLEDGED_LATE] };
      }
    }

    const recipients = await this.recipientModel
      .find(recipientMatch)
      .populate('employee', 'name employeeId department jobPosition branches photo email mobileNumber')
      .sort({ createdAt: -1 })
      .exec();

    // Filter by search query on employee name/id/dept
    let filteredRecipients = recipients;
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filteredRecipients = recipients.filter((r) => {
        const emp: any = r.employee || {};
        return (
          emp.name?.toLowerCase().includes(s) ||
          emp.employeeId?.toLowerCase().includes(s) ||
          emp.department?.toLowerCase().includes(s) ||
          emp.jobPosition?.toLowerCase().includes(s)
        );
      });
    }

    const timeline = await this.auditLogModel
      .find({ notice: new Types.ObjectId(id) })
      .populate('actor', 'name employeeId')
      .populate('employee', 'name employeeId')
      .sort({ timestamp: -1 })
      .limit(50)
      .exec();

    return {
      notice,
      metrics: {
        totalRecipients,
        seenCount,
        unseenCount,
        ackCount,
        pendingAckCount,
        seenPercentage: totalRecipients > 0 ? ((seenCount / totalRecipients) * 100).toFixed(1) : '0',
        ackPercentage: totalRecipients > 0 ? ((ackCount / totalRecipients) * 100).toFixed(1) : '0',
      },
      recipients: filteredRecipients,
      timeline,
    };
  }

  // Admin: Send Reminder to Pending Recipients
  async sendReminder(id: string, user: any): Promise<any> {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can send notice reminders');
    }

    const actorId = user._id || user.id || user.sub;
    const notice = await this.noticeModel.findById(id);
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const pendingRecipients = await this.recipientModel.find({
      notice: new Types.ObjectId(id),
      status: { $in: [RecipientStatus.DELIVERED, RecipientStatus.SEEN] },
    });

    if (pendingRecipients.length === 0) {
      return { success: true, count: 0, message: 'All recipients have already acknowledged this notice' };
    }

    const now = new Date();
    await this.recipientModel.updateMany(
      { _id: { $in: pendingRecipients.map((r) => r._id) } },
      { $set: { lastReminderSentAt: now } },
    );

    await this.logAuditEvent(id, actorId, NoticeEventType.NOTICE_REMINDER_SENT, undefined, {
      reminderCount: pendingRecipients.length,
    });

    return {
      success: true,
      count: pendingRecipients.length,
      message: `Sent reminder notifications to ${pendingRecipients.length} pending recipients`,
    };
  }

  // Admin: Get List of Notices
  async getAllNoticesAdmin(query: any): Promise<any> {
    const match: any = {};
    if (query.category) match.category = query.category;
    if (query.priority) match.priority = query.priority;
    if (query.status) match.status = query.status;
    if (query.search) {
      match.title = { $regex: query.search, $options: 'i' };
    }

    const notices = await this.noticeModel
      .find(match)
      .populate('createdBy', 'name email jobPosition')
      .sort({ createdAt: -1 })
      .exec();

    // Attach summary recipient metrics for each notice
    const noticesWithMetrics = await Promise.all(
      notices.map(async (n) => {
        const total = await this.recipientModel.countDocuments({ notice: n._id });
        const seen = await this.recipientModel.countDocuments({ notice: n._id, firstSeenAt: { $exists: true } });
        const ack = await this.recipientModel.countDocuments({
          notice: n._id,
          status: { $in: [RecipientStatus.ACKNOWLEDGED, RecipientStatus.ACKNOWLEDGED_LATE] },
        });

        return {
          ...n.toObject(),
          totalRecipients: total,
          seenCount: seen,
          ackCount: ack,
          seenPct: total > 0 ? ((seen / total) * 100).toFixed(0) : '0',
          ackPct: total > 0 ? ((ack / total) * 100).toFixed(0) : '0',
        };
      }),
    );

    return noticesWithMetrics;
  }

  // Admin: Delete Notice
  async deleteNotice(id: string, user: any): Promise<any> {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can delete notices');
    }

    const notice = await this.noticeModel.findById(id);
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    await this.noticeModel.findByIdAndDelete(id);
    await this.recipientModel.deleteMany({ notice: new Types.ObjectId(id) });
    await this.auditLogModel.deleteMany({ notice: new Types.ObjectId(id) });

    return { success: true, message: 'Notice and related records deleted successfully' };
  }
}
