import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument, EmployeeSchema } from '../user/schemas/employee.schema';
import { Branch, BranchDocument, BranchSchema } from '../branch/schemas/branch.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { cleanDutyPlan, WORK_DAYS } from '../../common/helpers/duty-plan.helper';
import { addDays, dayName, isDateStr, normalizeTime, todayStr } from '../../common/helpers/hr-date.helper';
import { RosterAssignment, RosterAssignmentDocument, RosterAssignmentSchema } from '../roster/schemas/roster.schema';
import { AttendanceRecord, AttendanceRecordDocument, AttendanceRecordSchema } from '../attendance/schemas/attendance.schema';
import { LeaveApplication, LeaveApplicationDocument, LeaveApplicationSchema } from '../leave/schemas/leave-application.schema';
import { GymCalendarDate, GymCalendarDateDocument, GymCalendarDateSchema } from '../gym-calendar/schemas/gym-calendar.schema';
import { RosterModule } from '../roster/roster.module';
import { RosterService } from '../roster/roster.service';

const HOLIDAY_TYPES = ['public_holiday', 'special_holiday', 'company_holiday', 'emergency_closure'];

const FIELDS = 'name employeeId photo jobPosition department branches status branchSchedules dutyInTime dutyOutTime shift';

// Weekly duty plans: which branch, which days and what times each person works.
@Injectable()
export class DutyPlanService {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(RosterAssignment.name) private readonly rosterModel: Model<RosterAssignmentDocument>,
    @InjectModel(AttendanceRecord.name) private readonly recordModel: Model<AttendanceRecordDocument>,
    @InjectModel(LeaveApplication.name) private readonly leaveModel: Model<LeaveApplicationDocument>,
    @InjectModel(GymCalendarDate.name) private readonly calendarModel: Model<GymCalendarDateDocument>,
    private readonly access: HrAccessService,
    private readonly roster: RosterService,
  ) {}

  private async branchNames() {
    const list = await this.branchModel.find({ status: { $ne: 'inactive' } }).select('name order').sort({ order: 1, name: 1 }).lean();
    return list.map((b: any) => b.name);
  }

  async list(query: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Duty plans are managed by HR / branch management');
    const filter: any = { status: { $nin: ['inactive', 'resigned', 'terminated'] } };
    const scoped = this.access.resolveBranchFilter(actor, query.branch);
    // A branch's list includes people planned there even if it is not their home branch.
    if (scoped) filter.$or = [{ branches: { $in: scoped } }, { 'branchSchedules.branch': { $in: scoped } }];
    if (query.search) {
      const q = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [{ $or: [{ name: { $regex: q, $options: 'i' } }, { employeeId: { $regex: q, $options: 'i' } }, { jobPosition: { $regex: q, $options: 'i' } }] }];
    }
    const [data, branches] = await Promise.all([this.employeeModel.find(filter).select(FIELDS).sort({ name: 1 }).lean(), this.branchNames()]);
    return { data, branches };
  }

  // Opening hours of a branch on a date: calendar override, else the
  // branch's hours for that weekday, else its default hours.
  private hoursFor(branch: any, date: string, day: string, overrides: any[]) {
    const own = overrides.find((o) => o.branchId === String(branch._id)) || overrides.find((o) => o.branchId === 'global');
    if (own && (own.gymStatus === 'closed' || HOLIDAY_TYPES.includes(own.dayType))) {
      return { open: '', close: '', closed: true, note: own.title || (own.dayType === 'weekly_off' ? 'Weekly off' : 'Holiday') };
    }
    const cfg = branch.operatingHours?.[day] || {};
    if (!own && cfg.isClosed) return { open: '', close: '', closed: true, note: 'Closed' };
    const open = normalizeTime(own?.openingTime) || normalizeTime(cfg.open) || normalizeTime(branch.openingTime);
    const close = normalizeTime(own?.closingTime) || normalizeTime(cfg.close) || normalizeTime(branch.closingTime);
    return { open, close, closed: false, note: own?.title || '' };
  }

  // Who is on duty on a date, branch by branch: the duty plan for that
  // weekday, replaced by roster entries when the person is rostered that day
  // (Friday duty, swaps, day off), with leave and attendance alongside.
  async daily(query: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('The daily duty view is for HR / branch management');
    const date = isDateStr(query.date) ? query.date : todayStr();
    const day = dayName(date);
    const scoped = this.access.resolveBranchFilter(actor, query.branch);
    const branchDocs = (await this.branchModel.find({ status: { $ne: 'inactive' } }).sort({ order: 1, name: 1 }).lean()).filter((b: any) => !scoped || scoped.includes(b.name));
    const names = branchDocs.map((b: any) => b.name);

    const [emps, roster, overrides] = await Promise.all([
      this.employeeModel
        .find({ status: { $nin: ['inactive', 'resigned', 'terminated'] }, $or: [{ branches: { $in: names } }, { 'branchSchedules.branch': { $in: names } }] })
        .select(FIELDS + ' joiningDate')
        .lean(),
      this.rosterModel.find({ date }).lean(),
      this.calendarModel.find({ dateStr: date }).lean(),
    ]);
    const empMap = new Map(emps.map((e: any) => [String(e._id), e]));
    // People rostered here from elsewhere.
    const extraIds = roster.filter((r) => names.includes(r.branch) && !empMap.has(String(r.employee))).map((r) => r.employee);
    if (extraIds.length) for (const e of await this.employeeModel.find({ _id: { $in: extraIds } }).select(FIELDS).lean()) empMap.set(String(e._id), e);
    const ids = [...empMap.keys()].map((id) => new Types.ObjectId(id));
    const [leaves, records] = await Promise.all([
      this.leaveModel
        .find({ employee: { $in: ids }, status: 'approved', $or: [{ approvedFromDate: { $lte: date }, approvedToDate: { $gte: date } }, { approvedFromDate: { $in: ['', null] }, fromDate: { $lte: date }, toDate: { $gte: date } }] })
        .select('employee leaveTypeName')
        .lean(),
      this.recordModel.find({ employee: { $in: ids }, date }).select('employee status inTime outTime isLate lateMinutes isEarlyLeave').lean(),
    ]);
    const leaveOf = new Map(leaves.map((l: any) => [String(l.employee), l.leaveTypeName]));
    const recOf = new Map(records.map((r: any) => [String(r.employee), r]));
    const rosterOf = new Map<string, any[]>();
    for (const r of roster) {
      const k = String(r.employee);
      if (!rosterOf.has(k)) rosterOf.set(k, []);
      rosterOf.get(k)!.push(r);
    }

    const byBranch = new Map<string, any[]>(names.map((n) => [n, []]));
    for (const [id, e] of empMap) {
      if (e.joiningDate && e.joiningDate > date) continue;
      const rostered = rosterOf.get(id) || [];
      let windows: any[] = [];
      if (rostered.length) {
        windows = rostered.filter((r) => r.dutyType !== 'off').map((r) => ({ branch: r.branch, start: normalizeTime(r.startTime), end: normalizeTime(r.endTime), source: 'roster', dutyType: r.dutyType, note: r.note || '' }));
      } else if ((e.branchSchedules || []).length) {
        windows = (e.branchSchedules || [])
          .filter((p: any) => (p.days?.length ? p.days : WORK_DAYS).includes(day))
          .map((p: any) => ({ branch: p.branch, start: normalizeTime(p.inTime), end: normalizeTime(p.outTime), source: 'plan', dutyType: '', note: p.notes || '' }));
      } else if (e.dutyInTime && e.dutyOutTime && day !== 'friday') {
        windows = [{ branch: e.branches?.[0] || '', start: normalizeTime(e.dutyInTime), end: normalizeTime(e.dutyOutTime), source: 'plan', dutyType: '', note: '' }];
      }
      const rec = recOf.get(id);
      for (const w of windows) {
        if (!byBranch.has(w.branch)) continue;
        byBranch.get(w.branch)!.push({
          employee: { _id: e._id, name: e.name, employeeId: e.employeeId, jobPosition: e.jobPosition, photo: e.photo },
          ...w,
          onLeave: leaveOf.get(id) || null,
          attendance: rec ? { status: rec.status, inTime: rec.inTime, outTime: rec.outTime, isLate: rec.isLate, lateMinutes: rec.lateMinutes, isEarlyLeave: rec.isEarlyLeave } : null,
        });
      }
    }
    const branches = branchDocs.map((b: any) => ({
      name: b.name,
      ...this.hoursFor(b, date, day, overrides.filter((o) => o.branchId === 'global' || o.branchId === String(b._id))),
      duties: (byBranch.get(b.name) || []).sort((x, y) => (x.start || '').localeCompare(y.start || '') || x.employee.name.localeCompare(y.employee.name)),
    }));
    return { date, day, today: todayStr(), branches };
  }

  // Friday rota for one branch: the next few Fridays with the branch's hours
  // and who is rostered, plus how many Fridays each person worked in the last
  // 12 weeks so the duty can be shared fairly.
  async fridays(query: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Friday duty is planned by HR / branch management');
    const allowed = this.access.resolveBranchFilter(actor);
    const branchDocs = (await this.branchModel.find({ status: { $ne: 'inactive' } }).sort({ order: 1, name: 1 }).lean()).filter((b: any) => !allowed || allowed.includes(b.name));
    if (!branchDocs.length) return { branch: '', branches: [], fridays: [], staff: [], since: '' };
    const branch: any = branchDocs.find((b: any) => b.name === query.branch) || branchDocs[0];

    const today = todayStr();
    let first = today;
    while (dayName(first) !== 'friday') first = addDays(first, 1);
    const count = Math.min(12, Math.max(1, Number(query.count) || 6));
    const dates = Array.from({ length: count }, (_, i) => addDays(first, i * 7));
    const since = addDays(first, -84);

    const emps = await this.employeeModel
      .find({ status: { $nin: ['inactive', 'resigned', 'terminated'] }, $or: [{ branches: branch.name }, { 'branchSchedules.branch': branch.name }] })
      .select(FIELDS)
      .sort({ name: 1 })
      .lean();
    const [upcoming, overrides] = await Promise.all([
      this.rosterModel.find({ branch: branch.name, date: { $in: dates }, dutyType: { $ne: 'off' } }).sort({ startTime: 1 }).lean(),
      this.calendarModel.find({ dateStr: { $in: dates }, branchId: { $in: ['global', String(branch._id)] } }).lean(),
    ]);
    // Visiting staff rostered here from another branch.
    const known = new Set(emps.map((e: any) => String(e._id)));
    const visitors = [...new Set(upcoming.map((r) => String(r.employee)).filter((id) => !known.has(id)))];
    if (visitors.length) emps.push(...(await this.employeeModel.find({ _id: { $in: visitors } }).select(FIELDS).lean()));
    const ids = emps.map((e: any) => e._id);
    const [past, leaves] = await Promise.all([
      this.rosterModel.find({ employee: { $in: ids }, date: { $gte: since, $lt: first }, dutyType: { $ne: 'off' } }).select('employee date').lean(),
      this.leaveModel
        .find({ employee: { $in: ids }, status: 'approved', $or: [{ approvedFromDate: { $lte: dates[dates.length - 1] }, approvedToDate: { $gte: dates[0] } }, { approvedFromDate: { $in: ['', null] }, fromDate: { $lte: dates[dates.length - 1] }, toDate: { $gte: dates[0] } }] })
        .select('employee fromDate toDate approvedFromDate approvedToDate leaveTypeName')
        .lean(),
    ]);
    const worked = new Map<string, Set<string>>();
    for (const r of past) {
      if (dayName(r.date) !== 'friday') continue;
      const k = String(r.employee);
      if (!worked.has(k)) worked.set(k, new Set());
      worked.get(k)!.add(r.date);
    }
    const leaveOn = new Map<string, string[]>();
    for (const l of leaves as any[]) {
      const from = l.approvedFromDate || l.fromDate;
      const to = l.approvedToDate || l.toDate;
      const hit = dates.filter((d) => d >= from && d <= to);
      if (hit.length) leaveOn.set(String(l.employee), [...(leaveOn.get(String(l.employee)) || []), ...hit]);
    }

    const fridays = dates.map((date) => ({
      date,
      ...this.hoursFor(branch, date, 'friday', overrides.filter((o) => o.dateStr === date)),
      duties: upcoming
        .filter((r) => r.date === date)
        .map((r) => ({ _id: r._id, employee: String(r.employee), employeeName: r.employeeName, designation: r.designation, dutyType: r.dutyType, startTime: r.startTime, endTime: r.endTime, note: r.note || '' })),
    }));
    const staff = emps.map((e: any) => {
      const days = [...(worked.get(String(e._id)) || [])].sort();
      const usual = (e.branchSchedules || []).find((p: any) => p.branch === branch.name && (p.days || []).includes('friday'));
      return {
        _id: e._id,
        name: e.name,
        employeeId: e.employeeId,
        jobPosition: e.jobPosition,
        photo: e.photo,
        visiting: !known.has(String(e._id)),
        recent: days.length,
        last: days[days.length - 1] || '',
        usualFriday: usual ? { start: usual.inTime, end: usual.outTime } : null,
        leaveOn: leaveOn.get(String(e._id)) || [],
      };
    });
    return { branch: branch.name, branches: branchDocs.map((b: any) => b.name), fridays, staff, since };
  }

  // Friday duty is saved as roster entries, so it keeps the roster history.
  async saveFridays(dto: any, actor: Actor) {
    const items = Array.isArray(dto?.items) ? dto.items : [];
    for (const it of items) {
      if (!isDateStr(it?.date) || dayName(it.date) !== 'friday') throw new BadRequestException(`${it?.date || 'Date'} is not a Friday`);
      if (!normalizeTime(it.startTime) || !normalizeTime(it.endTime)) throw new BadRequestException('Enter the start and end time for everyone on Friday duty');
    }
    return this.roster.upsertMany(items.map((it: any) => ({ ...it, dutyType: 'friday', isTemporary: false })), actor, dto?.reason || 'Friday duty');
  }

  async removeFriday(id: string, reason: string, actor: Actor) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid roster entry');
    const doc = await this.rosterModel.findById(id).select('date').lean();
    if (!doc) throw new NotFoundException('Roster entry not found');
    if (dayName(doc.date) !== 'friday') throw new BadRequestException('Only Friday duties can be removed here');
    return this.roster.remove(id, actor, reason || 'Removed from Friday duty');
  }

  async save(id: string, dto: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Duty plans are managed by HR / branch management');
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid employee');
    const emp = await this.employeeModel.findById(id);
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    const { entries, errors } = cleanDutyPlan(dto.branchSchedules, await this.branchNames());
    if (errors.length) throw new BadRequestException(errors.join('; '));
    // Branch-limited managers may only plan duties in their own branches.
    if (actor.scope === 'branch') {
      const outside = entries.filter((e) => !actor.branches.includes(e.branch)).map((e) => e.branch);
      if (outside.length) throw new ForbiddenException(`You can only plan duties in your branches (not ${[...new Set(outside)].join(', ')})`);
    }
    const planned = [...new Set(entries.map((e) => e.branch))];
    if (planned.length) {
      const home = emp.branches?.[0] && planned.includes(emp.branches[0]) ? emp.branches[0] : planned[0];
      const keep = actor.scope === 'branch' ? (emp.branches || []).filter((b) => !planned.includes(b)) : [];
      emp.branches = [home, ...planned.filter((b) => b !== home), ...keep];
    }
    emp.branchSchedules = entries as any;
    emp.markModified('branchSchedules');
    // Headline times (profile, mobile app) follow the first entry.
    emp.dutyInTime = entries[0]?.inTime || normalizeTime(emp.dutyInTime) || '';
    emp.dutyOutTime = entries[0]?.outTime || normalizeTime(emp.dutyOutTime) || '';
    await emp.save();
    return this.employeeModel.findById(emp._id).select(FIELDS).lean();
  }
}

@Controller('duty-plan')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DutyPlanController {
  constructor(
    private readonly service: DutyPlanService,
    private readonly access: HrAccessService,
  ) {}

  @Get()
  @RequirePermission('employee-duty-time', 'view')
  async list(@Query() q: any, @Req() req: any) {
    return { success: true, ...(await this.service.list(q, await this.access.getActor(req.user))) };
  }

  @Get('daily')
  @RequirePermission('daily-duty', 'view')
  async daily(@Query() q: any, @Req() req: any) {
    return { success: true, data: await this.service.daily(q, await this.access.getActor(req.user)) };
  }

  @Get('fridays')
  @RequirePermission('friday-duty', 'view')
  async fridays(@Query() q: any, @Req() req: any) {
    return { success: true, data: await this.service.fridays(q, await this.access.getActor(req.user)) };
  }

  @Post('fridays')
  @RequirePermission('friday-duty', 'add')
  async saveFridays(@Body() body: any, @Req() req: any) {
    const data = await this.service.saveFridays(body, await this.access.getActor(req.user));
    return { success: true, data, message: `${data.length} Friday dut${data.length === 1 ? 'y' : 'ies'} saved` };
  }

  @Delete('fridays/:id')
  @RequirePermission('friday-duty', 'delete')
  async removeFriday(@Param('id') id: string, @Query('reason') reason: string, @Req() req: any) {
    return { success: true, ...(await this.service.removeFriday(id, reason, await this.access.getActor(req.user))) };
  }

  @Put(':id')
  @RequirePermission('employee-duty-time', 'edit')
  async save(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.save(id, body, await this.access.getActor(req.user)), message: 'Duty plan saved' };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: RosterAssignment.name, schema: RosterAssignmentSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: LeaveApplication.name, schema: LeaveApplicationSchema },
      { name: GymCalendarDate.name, schema: GymCalendarDateSchema },
    ]),
    RosterModule,
  ],
  controllers: [DutyPlanController],
  providers: [DutyPlanService],
})
export class DutyPlanModule {}
