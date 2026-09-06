import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
  MaintenanceStatus,
  MaintenanceAssigneeType,
} from './schemas/maintenance-request.schema';
import {
  MaintenanceWorkUpdate,
  MaintenanceWorkUpdateDocument,
} from './schemas/maintenance-work-update.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import {
  AssignMaintenanceDto,
  AddWorkUpdateDto,
  CompleteMaintenanceDto,
  RejectMaintenanceDto,
  CancelMaintenanceDto,
} from './dto/maintenance-actions.dto';

const ADMIN_ROLES = ['SUPERADMIN', 'SUPER ADMIN', 'ADMIN', 'DIRECTOR', 'MANAGER', 'MD'];

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private readonly requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(MaintenanceWorkUpdate.name)
    private readonly workUpdateModel: Model<MaintenanceWorkUpdateDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
  ) {}

  private isManagerOrAdmin(role?: string): boolean {
    if (!role) return false;
    return ADMIN_ROLES.includes(role.toUpperCase());
  }

  private getUserId(user: any): Types.ObjectId {
    const rawId = user?._id || user?.id || user?.sub || user?.userId;
    if (!rawId) throw new BadRequestException('User context missing from authentication');
    return new Types.ObjectId(rawId.toString());
  }

  // CREATE REQUEST — open to any authenticated employee, no permission
  // gate. Branch/reportedBy/reportedDate are derived server-side from the
  // requester's own employee record, never taken from the client.
  async createRequest(dto: CreateMaintenanceRequestDto, user: any) {
    const userId = this.getUserId(user);
    const employee = await this.employeeModel.findById(userId).select('branches');
    if (!employee) {
      throw new BadRequestException('Employee profile not found for the current user');
    }

    const request = new this.requestModel({
      branch: employee.branches?.[0] || 'All Branches',
      category: dto.category,
      issue: dto.issue.trim(),
      description: dto.description?.trim(),
      priority: dto.priority,
      status: MaintenanceStatus.OPEN,
      reportedBy: userId,
      reportedDate: new Date(),
      beforePhotos: dto.photos || [],
      createdBy: userId,
    });

    const saved = await request.save();
    return this.findById(saved._id.toString(), user);
  }

  async findMyRequests(query: any, user: any) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { reportedBy: this.getUserId(user) };
    if (query.status && query.status !== 'all') {
      filter.status = query.status.toUpperCase();
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate('assignedToEmployee', 'name employeeId photo')
        .populate('assignedToVendor', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.requestModel.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findAll(query: any, user: any) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.search?.trim()) {
      filter.$or = [
        { issue: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }
    if (query.branch && query.branch !== 'all') filter.branch = query.branch;
    if (query.category && query.category !== 'all') filter.category = query.category;
    if (query.priority && query.priority !== 'all') filter.priority = query.priority.toUpperCase();
    if (query.status && query.status !== 'all') filter.status = query.status.toUpperCase();
    if (query.reportedBy && query.reportedBy !== 'all') filter.reportedBy = query.reportedBy;
    if (query.assignedToEmployee) filter.assignedToEmployee = query.assignedToEmployee;
    if (query.assignedToVendor) filter.assignedToVendor = query.assignedToVendor;

    if (query.startDate || query.endDate) {
      filter.reportedDate = {};
      if (query.startDate) filter.reportedDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.reportedDate.$lte = new Date(query.endDate);
    }

    if (query.isOverdue === 'true' || query.isOverdue === true) {
      filter.deadline = { $lt: new Date() };
      filter.status = { $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.REJECTED, MaintenanceStatus.CANCELLED] };
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate('reportedBy', 'name employeeId photo branch department')
        .populate('assignedToEmployee', 'name employeeId photo')
        .populate('assignedToVendor', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.requestModel.countDocuments(filter),
    ]);

    const now = new Date();
    const enriched = requests.map((r) => ({
      ...r,
      isOverdue:
        !!r.deadline &&
        new Date(r.deadline) < now &&
        ![MaintenanceStatus.COMPLETED, MaintenanceStatus.REJECTED, MaintenanceStatus.CANCELLED].includes(r.status as MaintenanceStatus),
    }));

    return {
      requests: enriched,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findById(id: string, user?: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid maintenance request ID format');
    }

    const request = await this.requestModel
      .findById(id)
      .populate('reportedBy', 'name employeeId photo branch department email mobileNumber')
      .populate('assignedToEmployee', 'name employeeId photo mobileNumber')
      .populate('assignedToVendor', 'name category contactPerson1')
      .populate('createdBy', 'name employeeId')
      .populate('updatedBy', 'name employeeId')
      .lean();

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const isManager = this.isManagerOrAdmin(user?.role);
    if (!isManager && user) {
      const userId = this.getUserId(user).toString();
      const reportedById = (request.reportedBy as any)?._id?.toString();
      if (reportedById !== userId) {
        throw new ForbiddenException('You are not authorized to view this maintenance request');
      }
    }

    const workUpdates = await this.workUpdateModel
      .find({ maintenanceRequest: id })
      .populate('updatedBy', 'name employeeId photo')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const isOverdue =
      !!request.deadline &&
      new Date(request.deadline) < now &&
      ![MaintenanceStatus.COMPLETED, MaintenanceStatus.REJECTED, MaintenanceStatus.CANCELLED].includes(request.status);

    return { ...request, isOverdue, workUpdates };
  }

  // ASSIGN / REVIEW — organizational-authority action: gated by the
  // controller's configurable "maintenance" permission AND this hardcoded
  // management-tier baseline, for the same reason approveTask/rejectTask
  // needed both in the Task module (see task.service.ts).
  async assignRequest(id: string, dto: AssignMaintenanceDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can assign maintenance requests');
    }

    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');

    if (dto.assignedToType === MaintenanceAssigneeType.EMPLOYEE) {
      const emp = await this.employeeModel.findById(dto.assignedToEmployee).select('_id');
      if (!emp) throw new BadRequestException('Selected employee not found');
      request.assignedToEmployee = emp._id as any;
      request.assignedToVendor = undefined;
    } else {
      const vendor = await this.vendorModel.findById(dto.assignedToVendor).select('_id');
      if (!vendor) throw new BadRequestException('Selected vendor not found');
      request.assignedToVendor = vendor._id as any;
      request.assignedToEmployee = undefined;
    }
    request.assignedToType = dto.assignedToType;

    if (dto.estimatedCost !== undefined) request.estimatedCost = dto.estimatedCost;
    if (dto.deadline) request.deadline = new Date(dto.deadline);

    request.status = MaintenanceStatus.ASSIGNED;
    request.updatedBy = this.getUserId(user) as any;
    await request.save();

    return this.findById(id, user);
  }

  // WORK UPDATE — same dual gate as assignRequest.
  async addWorkUpdate(id: string, dto: AddWorkUpdateDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can post work updates');
    }

    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');

    const userId = this.getUserId(user);

    await this.workUpdateModel.create({
      maintenanceRequest: id,
      update: dto.update.trim(),
      updatedBy: userId,
      photos: dto.photos || [],
    });

    request.latestWorkUpdate = dto.update.trim();
    if (dto.photos && dto.photos.length > 0) {
      request.beforePhotos = [...(request.beforePhotos || []), ...dto.photos];
    }
    if (request.status === MaintenanceStatus.ASSIGNED || request.status === MaintenanceStatus.UNDER_REVIEW) {
      request.status = MaintenanceStatus.IN_PROGRESS;
    }
    request.updatedBy = userId as any;
    await request.save();

    return this.findById(id, user);
  }

  // COMPLETE — same dual gate.
  async completeRequest(id: string, dto: CompleteMaintenanceDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can complete maintenance requests');
    }

    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');

    const userId = this.getUserId(user);

    if (dto.update || (dto.afterPhotos && dto.afterPhotos.length > 0)) {
      await this.workUpdateModel.create({
        maintenanceRequest: id,
        update: dto.update?.trim() || 'Maintenance work completed',
        updatedBy: userId,
        photos: dto.afterPhotos || [],
      });
      if (dto.update) request.latestWorkUpdate = dto.update.trim();
    }

    if (dto.afterPhotos && dto.afterPhotos.length > 0) {
      request.afterPhotos = [...(request.afterPhotos || []), ...dto.afterPhotos];
    }
    if (dto.actualCost !== undefined) request.actualCost = dto.actualCost;

    request.status = MaintenanceStatus.COMPLETED;
    request.completedDate = new Date();
    request.updatedBy = userId as any;
    await request.save();

    return this.findById(id, user);
  }

  // REJECT — same dual gate.
  async rejectRequest(id: string, dto: RejectMaintenanceDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can reject maintenance requests');
    }

    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');

    request.status = MaintenanceStatus.REJECTED;
    request.rejectionReason = dto.reason.trim();
    request.updatedBy = this.getUserId(user) as any;
    await request.save();

    return this.findById(id, user);
  }

  // CANCEL — same dual gate.
  async cancelRequest(id: string, dto: CancelMaintenanceDto, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can cancel maintenance requests');
    }

    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');

    request.status = MaintenanceStatus.CANCELLED;
    request.cancellationReason = dto.reason.trim();
    request.updatedBy = this.getUserId(user) as any;
    await request.save();

    return this.findById(id, user);
  }

  // MARK UNDER REVIEW — lightweight management action moving OPEN -> UNDER_REVIEW.
  async markUnderReview(id: string, user: any) {
    if (!this.isManagerOrAdmin(user?.role)) {
      throw new ForbiddenException('Only management and administrative roles can review maintenance requests');
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException('Maintenance request not found');
    if (request.status === MaintenanceStatus.OPEN) {
      request.status = MaintenanceStatus.UNDER_REVIEW;
      request.updatedBy = this.getUserId(user) as any;
      await request.save();
    }
    return this.findById(id, user);
  }

  // DASHBOARD STATS — role-aware.
  async getDashboardStats(user: any) {
    const isManager = this.isManagerOrAdmin(user?.role);
    const now = new Date();
    const openStatuses = [MaintenanceStatus.OPEN, MaintenanceStatus.UNDER_REVIEW, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS];

    if (!isManager) {
      const userId = this.getUserId(user);
      const filter = { reportedBy: userId };
      const [total, open, inProgress, completed, recent] = await Promise.all([
        this.requestModel.countDocuments(filter),
        this.requestModel.countDocuments({ ...filter, status: { $in: [MaintenanceStatus.OPEN, MaintenanceStatus.UNDER_REVIEW, MaintenanceStatus.ASSIGNED] } }),
        this.requestModel.countDocuments({ ...filter, status: MaintenanceStatus.IN_PROGRESS }),
        this.requestModel.countDocuments({ ...filter, status: MaintenanceStatus.COMPLETED }),
        this.requestModel.find(filter).select('issue category status createdAt').sort({ createdAt: -1 }).limit(5).lean(),
      ]);
      return { isManager: false, overview: { total, open, inProgress, completed }, recent };
    }

    const [total, open, underReview, assigned, inProgress, completed, overdue, costAgg] = await Promise.all([
      this.requestModel.countDocuments(),
      this.requestModel.countDocuments({ status: MaintenanceStatus.OPEN }),
      this.requestModel.countDocuments({ status: MaintenanceStatus.UNDER_REVIEW }),
      this.requestModel.countDocuments({ status: MaintenanceStatus.ASSIGNED }),
      this.requestModel.countDocuments({ status: MaintenanceStatus.IN_PROGRESS }),
      this.requestModel.countDocuments({ status: MaintenanceStatus.COMPLETED }),
      this.requestModel.countDocuments({ deadline: { $lt: now }, status: { $in: openStatuses } }),
      this.requestModel.aggregate([
        { $group: { _id: null, estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } }, actualCost: { $sum: { $ifNull: ['$actualCost', 0] } } } },
      ]),
    ]);

    return {
      isManager: true,
      overview: { total, open, underReview, assigned, inProgress, completed, overdue },
      cost: {
        estimatedCost: costAgg[0]?.estimatedCost || 0,
        actualCost: costAgg[0]?.actualCost || 0,
      },
    };
  }

  // REPORTS — mirrors task.service.ts#getReports's aggregate-pipeline idiom.
  async getReports(type: string, query: any) {
    const now = new Date();
    const dateFilter: any = {};
    if (query.startDate || query.endDate) {
      dateFilter.reportedDate = {};
      if (query.startDate) dateFilter.reportedDate.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.reportedDate.$lte = new Date(query.endDate);
    }

    const completedCond = { $eq: ['$status', MaintenanceStatus.COMPLETED] };
    const pendingCond = { $in: ['$status', [MaintenanceStatus.OPEN, MaintenanceStatus.UNDER_REVIEW, MaintenanceStatus.ASSIGNED]] };
    const overdueCond = {
      $and: [
        { $ne: ['$status', MaintenanceStatus.COMPLETED] },
        { $ne: ['$status', MaintenanceStatus.REJECTED] },
        { $ne: ['$status', MaintenanceStatus.CANCELLED] },
        { $ne: ['$deadline', null] },
        { $lt: ['$deadline', now] },
      ],
    };

    if (type === 'summary') {
      const [counts, costAgg] = await Promise.all([
        this.requestModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [completedCond, 1, 0] } },
              pending: { $sum: { $cond: [pendingCond, 1, 0] } },
              inProgress: { $sum: { $cond: [{ $eq: ['$status', MaintenanceStatus.IN_PROGRESS] }, 1, 0] } },
              overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', MaintenanceStatus.REJECTED] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', MaintenanceStatus.CANCELLED] }, 1, 0] } },
            },
          },
        ]),
        this.requestModel.aggregate([
          { $match: dateFilter },
          { $group: { _id: null, estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } }, actualCost: { $sum: { $ifNull: ['$actualCost', 0] } } } },
        ]),
      ]);
      const c = counts[0] || { total: 0, completed: 0, pending: 0, inProgress: 0, overdue: 0, rejected: 0, cancelled: 0 };
      const cost = costAgg[0] || { estimatedCost: 0, actualCost: 0 };
      return { ...c, estimatedCost: cost.estimatedCost, actualCost: cost.actualCost, costVariance: cost.actualCost - cost.estimatedCost };
    }

    if (type === 'branch-wise') {
      return this.requestModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$branch',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [completedCond, 1, 0] } },
            pending: { $sum: { $cond: [pendingCond, 1, 0] } },
            overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
            estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } },
            actualCost: { $sum: { $ifNull: ['$actualCost', 0] } },
          },
        },
        { $project: { _id: 0, branch: { $ifNull: ['$_id', 'Unassigned'] }, total: 1, completed: 1, pending: 1, overdue: 1, estimatedCost: 1, actualCost: 1 } },
        { $sort: { total: -1 } },
      ]);
    }

    if (type === 'category-wise') {
      return this.requestModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [completedCond, 1, 0] } },
            pending: { $sum: { $cond: [pendingCond, 1, 0] } },
            estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } },
            actualCost: { $sum: { $ifNull: ['$actualCost', 0] } },
          },
        },
        { $project: { _id: 0, category: '$_id', total: 1, completed: 1, pending: 1, estimatedCost: 1, actualCost: 1 } },
        { $sort: { total: -1 } },
      ]);
    }

    if (type === 'employee-wise') {
      const breakdown = await this.requestModel.aggregate([
        { $match: dateFilter },
        {
          $lookup: { from: 'employees', localField: 'reportedBy', foreignField: '_id', as: 'empInfo' },
        },
        { $unwind: '$empInfo' },
        {
          $group: {
            _id: '$empInfo._id',
            name: { $first: '$empInfo.name' },
            employeeId: { $first: '$empInfo.employeeId' },
            branch: { $first: '$empInfo.branch' },
            total: { $sum: 1 },
            completed: { $sum: { $cond: [completedCond, 1, 0] } },
            pending: { $sum: { $cond: [pendingCond, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', MaintenanceStatus.IN_PROGRESS] }, 1, 0] } },
            overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 200 },
      ]);
      return breakdown.map((b) => ({ ...b, employeeId: b.employeeId || 'N/A', branch: b.branch || 'N/A' }));
    }

    if (type === 'completion') {
      const counts = await this.requestModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [completedCond, 1, 0] } },
            pending: { $sum: { $cond: [pendingCond, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', MaintenanceStatus.IN_PROGRESS] }, 1, 0] } },
            overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
          },
        },
      ]);
      const c = counts[0] || { total: 0, completed: 0, pending: 0, inProgress: 0, overdue: 0 };
      return { ...c, completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 10000) / 100 : 0 };
    }

    if (type === 'overdue') {
      const requests = await this.requestModel
        .find({
          deadline: { $lt: now, $ne: null },
          status: { $in: [MaintenanceStatus.OPEN, MaintenanceStatus.UNDER_REVIEW, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] },
        })
        .populate('reportedBy', 'name employeeId')
        .populate('assignedToEmployee', 'name employeeId')
        .populate('assignedToVendor', 'name')
        .sort({ deadline: 1 })
        .lean();

      return requests.map((r) => ({
        ...r,
        daysOverdue: Math.max(0, Math.ceil((now.getTime() - new Date(r.deadline as Date).getTime()) / (1000 * 60 * 60 * 24))),
      }));
    }

    if (type === 'cost') {
      const [byBranch, byCategory, byMonth] = await Promise.all([
        this.requestModel.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$branch', estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } }, actualCost: { $sum: { $ifNull: ['$actualCost', 0] } } } },
          { $project: { _id: 0, branch: { $ifNull: ['$_id', 'Unassigned'] }, estimatedCost: 1, actualCost: 1 } },
          { $sort: { actualCost: -1 } },
        ]),
        this.requestModel.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$category', estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } }, actualCost: { $sum: { $ifNull: ['$actualCost', 0] } } } },
          { $project: { _id: 0, category: '$_id', estimatedCost: 1, actualCost: 1 } },
          { $sort: { actualCost: -1 } },
        ]),
        this.requestModel.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: { year: { $year: '$reportedDate' }, month: { $month: '$reportedDate' } },
              estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } },
              actualCost: { $sum: { $ifNull: ['$actualCost', 0] } },
            },
          },
          { $project: { _id: 0, year: '$_id.year', month: '$_id.month', estimatedCost: 1, actualCost: 1 } },
          { $sort: { year: 1, month: 1 } },
        ]),
      ]);
      return { byBranch, byCategory, byMonth };
    }

    if (type === 'vendor-wise') {
      const [byVendor, byEmployee] = await Promise.all([
        this.requestModel.aggregate([
          { $match: { ...dateFilter, assignedToVendor: { $ne: null } } },
          {
            $lookup: { from: 'vendors', localField: 'assignedToVendor', foreignField: '_id', as: 'vendorInfo' },
          },
          { $unwind: '$vendorInfo' },
          {
            $group: {
              _id: '$vendorInfo._id',
              name: { $first: '$vendorInfo.name' },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [completedCond, 1, 0] } },
              pending: { $sum: { $cond: [pendingCond, 1, 0] } },
              overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
              totalCost: { $sum: { $ifNull: ['$actualCost', 0] } },
            },
          },
          { $sort: { total: -1 } },
        ]),
        this.requestModel.aggregate([
          { $match: { ...dateFilter, assignedToEmployee: { $ne: null } } },
          {
            $lookup: { from: 'employees', localField: 'assignedToEmployee', foreignField: '_id', as: 'empInfo' },
          },
          { $unwind: '$empInfo' },
          {
            $group: {
              _id: '$empInfo._id',
              name: { $first: '$empInfo.name' },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [completedCond, 1, 0] } },
              pending: { $sum: { $cond: [pendingCond, 1, 0] } },
              overdue: { $sum: { $cond: [overdueCond, 1, 0] } },
              totalCost: { $sum: { $ifNull: ['$actualCost', 0] } },
            },
          },
          { $sort: { total: -1 } },
        ]),
      ]);
      return { byVendor, byEmployee };
    }

    throw new BadRequestException(`Unknown report type: ${type}`);
  }
}
