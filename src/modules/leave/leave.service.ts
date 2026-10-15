import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { LeaveType, LeaveTypeDocument } from '../leave-type/schemas/leave-type.schema';
import { FINAL_DECISIONS, LeaveApplication, LeaveApplicationDocument, RECOMMENDATIONS } from './schemas/leave-application.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { AttendanceService } from '../attendance/attendance.service';
import { diffDays, eachDate, isDateStr, todayStr } from '../../common/helpers/hr-date.helper';
import { createWithRefNo } from '../../common/helpers/ref-no.helper';

type Stage = 'branch' | 'hr' | 'director';
const STAGE_OF_STATUS: Record<string, Stage> = { pending_branch: 'branch', pending_hr: 'hr', pending_director: 'director' };
const NEXT_STATUS: Record<Stage, string> = { branch: 'pending_hr', hr: 'pending_director', director: 'approved' };

@Injectable()
export class LeaveService {
  constructor(
    @InjectModel(LeaveApplication.name) private readonly leaveModel: Model<LeaveApplicationDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(LeaveType.name) private readonly leaveTypeModel: Model<LeaveTypeDocument>,
    private readonly access: HrAccessService,
    private readonly attendance: AttendanceService,
  ) {}

  // ---------------------------------------------------------------------
  // Balances / previous record
  // ---------------------------------------------------------------------

  async balances(employeeId: string, year = new Date().getFullYear()) {
    const emp = await this.employeeModel.findById(employeeId).select('gender').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    const types = await this.leaveTypeModel.find({ status: 'active' }).sort({ order: 1 }).lean();
    const taken = await this.leaveModel.aggregate([
      { $match: { employee: new Types.ObjectId(employeeId), status: 'approved', fromDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
      { $group: { _id: '$leaveType', days: { $sum: '$approvedDays' } } },
    ]);
    const pending = await this.leaveModel.aggregate([
      { $match: { employee: new Types.ObjectId(employeeId), status: { $in: ['pending_branch', 'pending_hr', 'pending_director'] }, fromDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
      { $group: { _id: '$leaveType', days: { $sum: '$totalDays' } } },
    ]);
    const takenMap = new Map(taken.map((t) => [String(t._id), t.days]));
    const pendingMap = new Map(pending.map((t) => [String(t._id), t.days]));
    return types
      .filter((t) => t.applicableFor === 'All' || !emp.gender || t.applicableFor === emp.gender)
      .map((t) => {
        const used = takenMap.get(String(t._id)) || 0;
        return {
          leaveTypeId: String(t._id),
          leaveTypeName: t.name,
          isPaid: t.isPaid === 'yes',
          allowed: t.daysAllowed,
          taken: used,
          pending: pendingMap.get(String(t._id)) || 0,
          remaining: Math.max(0, t.daysAllowed - used),
        };
      });
  }

  private async previousRecord(employeeId: string) {
    const year = new Date().getFullYear();
    const balances = await this.balances(employeeId, year);
    const last = await this.leaveModel.findOne({ employee: new Types.ObjectId(employeeId), status: 'approved' }).sort({ fromDate: -1 }).lean();
    return {
      year,
      balances: balances.map(({ leaveTypeId, leaveTypeName, allowed, taken, remaining }) => ({ leaveTypeId, leaveTypeName, allowed, taken, remaining })),
      totalTakenThisYear: balances.reduce((s, b) => s + b.taken, 0),
      lastLeave: last
        ? { fromDate: last.approvedFromDate || last.fromDate, toDate: last.approvedToDate || last.toDate, days: last.approvedDays, leaveTypeName: last.leaveTypeName }
        : null,
    };
  }

  // ---------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------

  async apply(dto: any, actor: Actor) {
    const employeeId = dto.employeeId && dto.employeeId !== actor.id ? dto.employeeId : actor.id;
    const onBehalf = employeeId !== actor.id;
    const emp = await this.employeeModel.findById(employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    if (onBehalf) {
      if (actor.scope === 'self') throw new ForbiddenException('You can only apply leave for yourself');
      this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    }

    if (!isDateStr(dto.fromDate) || !isDateStr(dto.toDate)) throw new BadRequestException('From/To dates must be YYYY-MM-DD');
    if (dto.toDate < dto.fromDate) throw new BadRequestException('To date cannot be before From date');
    if (!dto.reason || !String(dto.reason).trim()) throw new BadRequestException('Reason is required');
    const type = await this.leaveTypeModel.findById(dto.leaveTypeId).lean();
    if (!type || type.status !== 'active') throw new BadRequestException('Select a valid leave type');

    const halfDay = !!dto.halfDay && dto.fromDate === dto.toDate;
    const totalDays = halfDay ? 0.5 : diffDays(dto.fromDate, dto.toDate) + 1;

    const overlap = await this.leaveModel.findOne({
      employee: emp._id,
      status: { $in: ['pending_branch', 'pending_hr', 'pending_director', 'approved'] },
      fromDate: { $lte: dto.toDate },
      toDate: { $gte: dto.fromDate },
    });
    if (overlap) throw new BadRequestException(`Overlaps with application ${overlap.applicationNo} (${overlap.fromDate} → ${overlap.toDate})`);

    const cfg = await this.access.getConfig();
    const attachments = (Array.isArray(dto.attachments) ? dto.attachments : [])
      .filter((a: any) => a?.url)
      .slice(0, 10)
      .map((a: any) => ({ name: String(a.name || 'Attachment'), url: String(a.url), kind: String(a.kind || '') }));

    return createWithRefNo<LeaveApplicationDocument>(this.leaveModel, 'applicationNo', 'LV', {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      employeePhoto: emp.photo || '',
      branch: emp.branches?.[0] || '',
      department: emp.department || '',
      designation: emp.jobPosition || '',
      leaveType: type._id,
      leaveTypeName: type.name,
      isPaid: type.isPaid === 'yes',
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      halfDay,
      totalDays,
      reason: String(dto.reason).trim(),
      contactDuringLeave: dto.contactDuringLeave || '',
      handoverTo: dto.handoverTo || '',
      attachments,
      previousLeaveRecord: await this.previousRecord(String(emp._id)),
      status: cfg.leaveSkipBranchStage ? 'pending_hr' : 'pending_branch',
      actions: [],
      appliedBy: { id: actor.id, name: actor.name, onBehalf },
    });
  }

  // ---------------------------------------------------------------------
  // Workflow
  // ---------------------------------------------------------------------

  // Stages this actor may act on for a given application.
  async actableStages(actor: Actor): Promise<Stage[]> {
    const cfg = await this.access.getConfig();
    if (actor.isSuperAdmin) return ['branch', 'hr', 'director'];
    const stages: Stage[] = [];
    if (this.access.roleIn(actor.role, cfg.leaveStages.branch)) stages.push('branch');
    if (this.access.roleIn(actor.role, cfg.leaveStages.hr)) stages.push('hr');
    if (this.access.roleIn(actor.role, cfg.leaveStages.director)) stages.push('director');
    return stages;
  }

  private canActOn(app: any, actor: Actor, stages: Stage[]) {
    const stage = STAGE_OF_STATUS[app.status];
    if (!stage) return false;
    if (String(app.employee) === actor.id && !actor.isSuperAdmin) return false; // never approve own leave
    // Each stage must be a different person — someone who already
    // recommended this application cannot also verify/approve it later.
    if (!actor.isSuperAdmin && (app.actions || []).some((a: any) => a.actorId === actor.id)) return false;
    // Directors may finalize at any pending stage (fast-track).
    if (!stages.includes(stage) && !stages.includes('director')) return false;
    if (stage === 'branch' && stages.includes('branch') && !stages.includes('director') && actor.scope === 'branch') {
      return actor.branches.includes(app.branch);
    }
    return true;
  }

  async act(id: string, dto: any, actor: Actor) {
    const app = await this.leaveModel.findById(id);
    if (!app) throw new NotFoundException('Leave application not found');
    const stages = await this.actableStages(actor);
    if (!this.canActOn(app, actor, stages)) throw new ForbiddenException('You cannot act on this application at its current stage');

    const currentStage = STAGE_OF_STATUS[app.status];
    // A director acting early finalizes the application directly.
    const stage: Stage = stages.includes(currentStage) ? currentStage : 'director';
    const decision = String(dto.decision || '');
    const remarks = String(dto.remarks || '').trim();

    if (stage === 'director') {
      if (!FINAL_DECISIONS.includes(decision as any)) throw new BadRequestException('Decision must be approved, partially_approved or rejected');
      if (decision === 'rejected' && !remarks) throw new BadRequestException('Remarks are required when rejecting');
      let from = app.fromDate;
      let to = app.toDate;
      let days = app.totalDays;
      if (decision === 'partially_approved') {
        from = dto.approvedFromDate || app.fromDate;
        to = dto.approvedToDate || app.toDate;
        if (!isDateStr(from) || !isDateStr(to) || from < app.fromDate || to > app.toDate || to < from) {
          throw new BadRequestException('Approved dates must fall within the requested range');
        }
        days = app.halfDay ? 0.5 : diffDays(from, to) + 1;
      }
      app.actions.push({ stage, decision, recommendedDays: days, remarks, actorId: actor.id, actorName: actor.name, actorRole: actor.role, actedAt: new Date() });
      app.finalRemarks = remarks;
      if (decision === 'rejected') {
        app.status = 'rejected';
        app.approvedDays = 0;
      } else {
        app.status = 'approved';
        app.approvedDays = days;
        app.approvedFromDate = from;
        app.approvedToDate = to;
      }
      app.markModified('actions');
      await app.save();
      if (app.status === 'approved') await this.syncAttendance(app);
      return app;
    }

    if (!RECOMMENDATIONS.includes(decision as any)) throw new BadRequestException('Recommendation must be recommended, partially_recommended or not_recommended');
    if (decision !== 'recommended' && !remarks) throw new BadRequestException('Remarks are required for a partial / negative recommendation');
    const recommendedDays = decision === 'partially_recommended' ? Number(dto.recommendedDays) : decision === 'recommended' ? app.totalDays : 0;
    if (decision === 'partially_recommended' && (!(recommendedDays > 0) || recommendedDays >= app.totalDays)) {
      throw new BadRequestException('Recommended days must be more than 0 and less than the requested days');
    }
    app.actions.push({ stage, decision, recommendedDays, remarks, actorId: actor.id, actorName: actor.name, actorRole: actor.role, actedAt: new Date() });
    app.status = NEXT_STATUS[stage];
    app.markModified('actions');
    await app.save();
    return app;
  }

  async cancel(id: string, reason: string, actor: Actor) {
    const app = await this.leaveModel.findById(id);
    if (!app) throw new NotFoundException('Leave application not found');
    const own = String(app.employee) === actor.id;
    const wasApproved = app.status === 'approved';
    if (own) {
      if (!STAGE_OF_STATUS[app.status]) throw new BadRequestException('Only pending applications can be withdrawn');
    } else {
      if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can cancel another employee’s leave');
      if (!['pending_branch', 'pending_hr', 'pending_director', 'approved'].includes(app.status)) throw new BadRequestException('Application cannot be cancelled');
    }
    app.status = 'cancelled';
    app.cancelReason = reason || '';
    await app.save();
    if (wasApproved) await this.syncAttendance(app);
    return app;
  }

  // Re-processes attendance for the leave days that have already passed.
  private async syncAttendance(app: any) {
    const today = todayStr();
    const from = app.approvedFromDate || app.fromDate;
    const to = app.approvedToDate || app.toDate;
    for (const date of eachDate(app.fromDate < from ? app.fromDate : from, app.toDate > to ? app.toDate : to)) {
      if (date > today) break;
      await this.attendance.processDay(String(app.employee), date).catch(() => null);
    }
  }

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  async list(query: any, actor: Actor) {
    const filter: any = {};
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) filter.branch = { $in: branches };
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status === 'pending' ? { $in: ['pending_branch', 'pending_hr', 'pending_director'] } : query.status;
    }
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id); // scope always wins over query
    if (query.leaveType && query.leaveType !== 'all') filter.leaveType = new Types.ObjectId(query.leaveType);
    if (query.from) filter.toDate = { $gte: query.from };
    if (query.to) filter.fromDate = { $lte: query.to };
    if (query.search) {
      filter.$or = [
        { employeeName: { $regex: query.search, $options: 'i' } },
        { employeeCode: { $regex: query.search, $options: 'i' } },
        { applicationNo: { $regex: query.search, $options: 'i' } },
      ];
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 20);
    const [total, data, statusCounts] = await Promise.all([
      this.leaveModel.countDocuments(filter),
      this.leaveModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.leaveModel.aggregate([{ $match: { ...filter, status: { $exists: true } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    const stats = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1, stats };
  }

  // Applications waiting on this actor.
  async pendingForMe(actor: Actor) {
    const stages = await this.actableStages(actor);
    if (!stages.length) return { stages, data: [] };
    const statuses = stages.includes('director')
      ? ['pending_branch', 'pending_hr', 'pending_director']
      : stages.map((s) => `pending_${s}`);
    const filter: any = { status: { $in: statuses }, employee: { $ne: new Types.ObjectId(actor.id) } };
    if (!actor.isSuperAdmin) filter['actions.actorId'] = { $ne: actor.id };
    if (actor.scope === 'branch' && !stages.includes('director')) filter.branch = { $in: actor.branches };
    const data = await this.leaveModel.find(filter).sort({ fromDate: 1 }).lean();
    // Directors see everything pending but their own queue first.
    data.sort((a, b) => Number(b.status === 'pending_director') - Number(a.status === 'pending_director'));
    return { stages, data };
  }

  async findOne(id: string, actor: Actor) {
    const app: any = await this.leaveModel.findById(id).lean();
    if (!app) throw new NotFoundException('Leave application not found');
    const stages = await this.actableStages(actor);
    const canAct = this.canActOn(app, actor, stages);
    if (!canAct) this.access.assertCanAccess(actor, String(app.employee), app.branch);
    return { ...app, canAct, actingStage: canAct ? (stages.includes(STAGE_OF_STATUS[app.status]) ? STAGE_OF_STATUS[app.status] : 'director') : null };
  }

  // Year leave register: per employee, days taken per leave type.
  async register(query: any, actor: Actor) {
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const match: any = { status: 'approved', fromDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } };
    if (actor.scope === 'self') match.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) match.branch = { $in: branches };
    }
    const rows = await this.leaveModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { employee: '$employee', leaveTypeName: '$leaveTypeName' },
          employeeName: { $first: '$employeeName' },
          employeeCode: { $first: '$employeeCode' },
          branch: { $first: '$branch' },
          days: { $sum: '$approvedDays' },
          count: { $sum: 1 },
        },
      },
    ]);
    const types = await this.leaveTypeModel.find({ status: 'active' }).sort({ order: 1 }).select('name daysAllowed').lean();
    const byEmp = new Map<string, any>();
    for (const r of rows) {
      const key = String(r._id.employee);
      if (!byEmp.has(key)) byEmp.set(key, { employeeId: key, employeeName: r.employeeName, employeeCode: r.employeeCode, branch: r.branch, byType: {}, totalDays: 0, applications: 0 });
      const e = byEmp.get(key);
      e.byType[r._id.leaveTypeName] = r.days;
      e.totalDays += r.days;
      e.applications += r.count;
    }
    return { year, leaveTypes: types, data: [...byEmp.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName)) };
  }
}
