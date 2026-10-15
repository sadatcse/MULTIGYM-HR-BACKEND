import { Controller, Get, Injectable, Module, Query, Req, UseGuards } from '@nestjs/common';
import { InjectConnection, InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Employee, EmployeeDocument, EmployeeSchema } from '../user/schemas/employee.schema';
import { Branch, BranchDocument, BranchSchema } from '../branch/schemas/branch.schema';
import { LeaveApplication, LeaveApplicationDocument, LeaveApplicationSchema } from '../leave/schemas/leave-application.schema';
import { AttendanceModule } from '../attendance/attendance.module';
import { AttendanceService } from '../attendance/attendance.service';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { todayStr } from '../../common/helpers/hr-date.helper';

const ACTIVE_TASK = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_APPROVAL', 'OVERDUE'];
const OPEN_MAINTENANCE = ['OPEN', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS'];
const WORKED = ['present', 'late', 'half_day', 'missing_punch'];
const PENDING_LEAVE = ['pending_branch', 'pending_hr', 'pending_director'];
const INACTIVE = ['resigned', 'terminated', 'inactive'];

@Injectable()
export class HrDashboardService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(LeaveApplication.name) private readonly leaveModel: Model<LeaveApplicationDocument>,
    private readonly attendance: AttendanceService,
    private readonly access: HrAccessService,
  ) {}

  private async count(collection: string, filter: any) {
    try {
      return await this.connection.collection(collection).countDocuments(filter);
    } catch {
      return 0;
    }
  }

  private summaryCache = new Map<string, { at: number; value: any }>();

  async summary(query: any, actor: Actor) {
    const key = `${actor.scope}|${actor.scope === 'self' ? actor.id : actor.branches.join(',')}|${query.branch || ''}`;
    const hit = this.summaryCache.get(key);
    if (hit && Date.now() - hit.at < 20_000) return hit.value;
    const value = await this.buildSummary(query, actor);
    if (this.summaryCache.size > 200) this.summaryCache.clear();
    this.summaryCache.set(key, { at: Date.now(), value });
    return value;
  }

  private async buildSummary(query: any, actor: Actor) {
    const today = todayStr();
    const branchFilter = this.access.resolveBranchFilter(actor, query.branch);
    const branchIn = branchFilter ? { $in: branchFilter } : undefined;

    const daily = await this.attendance.daily({ date: today, branch: query.branch }, actor);
    const rows = daily.data;

    const leaveFilter: any = { status: 'approved', approvedFromDate: { $lte: today }, approvedToDate: { $gte: today } };
    const pendingLeaveFilter: any = { status: { $in: PENDING_LEAVE } };
    const taskFilter: any = { status: { $in: ACTIVE_TASK } };
    const overdueFilter: any = { $or: [{ status: 'OVERDUE' }, { status: { $in: ACTIVE_TASK }, deadline: { $lt: new Date() } }] };
    const maintenanceFilter: any = { status: { $in: OPEN_MAINTENANCE } };
    const reqFilter: any = { status: { $in: ['submitted', 'verified', 'approved', 'purchased'] } };
    const caseFilter: any = { status: { $ne: 'closed' } };
    if (branchIn) {
      for (const f of [leaveFilter, pendingLeaveFilter, taskFilter, maintenanceFilter, reqFilter, caseFilter]) f.branch = branchIn;
      overdueFilter.branch = branchIn;
    }
    if (actor.scope === 'self') {
      leaveFilter.employee = pendingLeaveFilter.employee = actor.id;
    }

    const [onLeaveList, pendingLeave, pendingTasks, overdueTasks, openMaintenance, openRequisitions, openCases] = await Promise.all([
      this.leaveModel.find(leaveFilter).select('employee employeeName branch leaveTypeName approvedToDate').lean(),
      this.leaveModel.countDocuments(pendingLeaveFilter),
      this.count('tasks', taskFilter),
      this.count('tasks', overdueFilter),
      this.count('maintenance_requests', maintenanceFilter),
      actor.scope === 'self' ? 0 : this.count('requisitions', reqFilter),
      actor.scope === 'self' ? 0 : this.count('disciplinary_cases', caseFilter),
    ]);

    const onLeaveIds = new Set(onLeaveList.map((l) => String(l.employee)));
    const stat = (r: any[]) => {
      const present = r.filter((x) => WORKED.includes(x.status)).length;
      const onLeave = r.filter((x) => x.status === 'leave' || onLeaveIds.has(String(x.employee._id))).length;
      const off = r.filter((x) => x.status === 'weekend' || x.status === 'holiday').length;
      return {
        totalEmployees: r.length,
        present,
        absent: r.filter((x) => (x.status === 'absent' || x.status === 'not_punched') && !onLeaveIds.has(String(x.employee._id))).length,
        onLeave,
        late: r.filter((x) => x.isLate).length,
        earlyLeave: r.filter((x) => x.isEarlyLeave).length,
        missingPunch: r.filter((x) => x.status === 'missing_punch').length,
        off,
      };
    };

    const branchNames = branchFilter || (await this.branchModel.find({ status: 'active' }).sort({ order: 1 }).select('name').lean()).map((b) => b.name);
    const byBranch = branchNames.map((name) => {
      const r = rows.filter((x) => x.branch === name);
      return { branch: name, ...stat(r), pendingLeave: 0 };
    });
    if (actor.scope !== 'self') {
      const pendingByBranch = await this.leaveModel.aggregate([{ $match: pendingLeaveFilter }, { $group: { _id: '$branch', n: { $sum: 1 } } }]);
      for (const p of pendingByBranch) {
        const b = byBranch.find((x) => x.branch === p._id);
        if (b) b.pendingLeave = p.n;
      }
    }
    const unassigned = rows.filter((x) => !x.branch || !branchNames.includes(x.branch));
    if (unassigned.length && actor.scope === 'all') byBranch.push({ branch: 'Unassigned', ...stat(unassigned), pendingLeave: 0 });

    return {
      date: today,
      scope: actor.scope,
      totals: { ...stat(rows), pendingLeave, pendingTasks, overdueTasks, openMaintenance, openRequisitions, openCases },
      byBranch,
      lateToday: rows.filter((x) => x.isLate).slice(0, 10).map((x) => ({ name: x.employee.name, branch: x.branch, inTime: x.inTime, lateMinutes: x.lateMinutes })),
      onLeaveToday: onLeaveList.slice(0, 10),
    };
  }

  // Branch-wise staff strength by department / designation / status.
  async staffStrength(actor: Actor) {
    const match: any = {};
    if (actor.scope === 'branch') match['branches.0'] = { $in: actor.branches };
    if (actor.scope === 'self') match._id = actor.id;
    const emps = await this.employeeModel.find(match).select('name branches department jobPosition status employeeType').lean();
    const map = new Map<string, any>();
    for (const e of emps) {
      const branch = e.branches?.[0] || 'Unassigned';
      if (!map.has(branch)) map.set(branch, { branch, total: 0, active: 0, inactive: 0, multiBranch: 0, byDepartment: {}, byDesignation: {}, byStatus: {}, byType: {} });
      const b = map.get(branch);
      b.total++;
      if (INACTIVE.includes(e.status)) b.inactive++;
      else b.active++;
      if ((e.branches || []).length > 1) b.multiBranch++;
      const inc = (obj: any, k?: string) => (obj[k || 'Not set'] = (obj[k || 'Not set'] || 0) + 1);
      if (!INACTIVE.includes(e.status)) {
        inc(b.byDepartment, e.department);
        inc(b.byDesignation, e.jobPosition);
        inc(b.byType, e.employeeType);
      }
      inc(b.byStatus, e.status);
    }
    return [...map.values()].sort((a, b) => b.active - a.active);
  }
}

@Controller('hr-dashboard')
@UseGuards(JwtAuthGuard)
export class HrDashboardController {
  constructor(
    private readonly service: HrDashboardService,
    private readonly access: HrAccessService,
  ) {}

  @Get('summary')
  async summary(@Query() query: any, @Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.summary(query, actor) };
  }

  @Get('staff-strength')
  async staffStrength(@Req() req: any) {
    const actor = await this.access.getActor(req.user);
    return { success: true, data: await this.service.staffStrength(actor) };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: LeaveApplication.name, schema: LeaveApplicationSchema },
    ]),
    AttendanceModule,
  ],
  controllers: [HrDashboardController],
  providers: [HrDashboardService],
})
export class HrDashboardModule {}
