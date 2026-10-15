import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { Branch, BranchDocument } from '../branch/schemas/branch.schema';
import { GymCalendarDate, GymCalendarDateDocument } from '../gym-calendar/schemas/gym-calendar.schema';
import { GymWeeklyDefault, GymWeeklyDefaultDocument } from '../gym-calendar/schemas/gym-weekly-default.schema';
import { RosterAssignment, RosterAssignmentDocument } from '../roster/schemas/roster.schema';
import { LeaveApplication, LeaveApplicationDocument } from '../leave/schemas/leave-application.schema';
import {
  ATTENDANCE_STATUSES,
  AttendanceCorrection,
  AttendanceCorrectionDocument,
  AttendanceDevice,
  AttendanceDeviceDocument,
  AttendancePunch,
  AttendancePunchDocument,
  AttendanceRecord,
  AttendanceRecordDocument,
} from './schemas/attendance.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import {
  dayName,
  instantToLocal,
  isDateStr,
  isMonthStr,
  localToInstant,
  monthRange,
  timeToMinutes,
  todayStr,
} from '../../common/helpers/hr-date.helper';

const INACTIVE_STATUSES = ['resigned', 'terminated', 'inactive'];
const HOLIDAY_TYPES = ['public_holiday', 'special_holiday', 'company_holiday', 'emergency_closure'];
const WORKED_STATUSES = ['present', 'late', 'half_day', 'missing_punch'];

export interface IncomingPunch {
  deviceUserId: string;
  // Either an absolute instant or a business-local "YYYY-MM-DD HH:mm[:ss]".
  time: Date | string;
  deviceSerial?: string;
  branch?: string;
  source?: 'device' | 'import' | 'manual' | 'app';
  verifyMode?: string;
  punchState?: string;
}

interface Expected {
  start: string;
  end: string;
  source: string;
  dayOff: 'weekend' | 'holiday' | null;
  offTitle?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceDevice.name) private readonly deviceModel: Model<AttendanceDeviceDocument>,
    @InjectModel(AttendancePunch.name) private readonly punchModel: Model<AttendancePunchDocument>,
    @InjectModel(AttendanceRecord.name) private readonly recordModel: Model<AttendanceRecordDocument>,
    @InjectModel(AttendanceCorrection.name) private readonly correctionModel: Model<AttendanceCorrectionDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(GymCalendarDate.name) private readonly calendarModel: Model<GymCalendarDateDocument>,
    @InjectModel(GymWeeklyDefault.name) private readonly weeklyModel: Model<GymWeeklyDefaultDocument>,
    @InjectModel(RosterAssignment.name) private readonly rosterModel: Model<RosterAssignmentDocument>,
    @InjectModel(LeaveApplication.name) private readonly leaveModel: Model<LeaveApplicationDocument>,
    private readonly access: HrAccessService,
  ) {}

  private async offset() {
    return (await this.access.getConfig()).attendance.timezoneOffsetMinutes ?? 360;
  }

  // ======================================================================
  // Devices
  // ======================================================================

  async touchDevice(serialNumber: string, ip?: string) {
    const sn = String(serialNumber || '').trim();
    if (!sn) return null;
    return this.deviceModel.findOneAndUpdate(
      { serialNumber: sn },
      { $set: { lastSeenAt: new Date(), ...(ip ? { ipAddress: ip } : {}) }, $setOnInsert: { serialNumber: sn, name: `Device ${sn}`, status: 'pending' } },
      { upsert: true, new: true },
    );
  }

  listDevices() {
    return this.deviceModel.find().sort({ createdAt: -1 }).lean();
  }

  async saveDevice(dto: any, id?: string) {
    const payload: any = {};
    for (const k of ['serialNumber', 'name', 'branch', 'model', 'ipAddress', 'status']) if (dto[k] !== undefined) payload[k] = dto[k];
    if (id) {
      const doc = await this.deviceModel.findByIdAndUpdate(id, { $set: payload }, { new: true });
      if (!doc) throw new NotFoundException('Device not found');
      return doc;
    }
    if (!payload.serialNumber) throw new BadRequestException('Serial number is required');
    return this.deviceModel.create(payload);
  }

  async removeDevice(id: string) {
    await this.deviceModel.findByIdAndDelete(id);
    return { message: 'Device removed' };
  }

  // ======================================================================
  // Punch ingestion
  // ======================================================================

  async ingestPunches(punches: IncomingPunch[]) {
    if (!punches.length) return { received: 0, stored: 0, unmatched: 0, processedDays: 0 };
    const off = await this.offset();

    const ids = [...new Set(punches.map((p) => String(p.deviceUserId).trim()).filter(Boolean))];
    const emps = await this.employeeModel
      .find({ $or: [{ deviceUserId: { $in: ids } }, { employeeId: { $in: ids } }] })
      .select('deviceUserId employeeId branches')
      .lean();
    const byDeviceId = new Map<string, any>();
    for (const e of emps) {
      if (e.employeeId) byDeviceId.set(String(e.employeeId), e);
    }
    // Explicit device enrolment IDs win over an employeeId coincidence.
    for (const e of emps) {
      if (e.deviceUserId) byDeviceId.set(String(e.deviceUserId), e);
    }

    const docs: any[] = [];
    let unmatched = 0;
    for (const p of punches) {
      const uid = String(p.deviceUserId).trim();
      let instant: Date;
      if (p.time instanceof Date) instant = p.time;
      else {
        const m = String(p.time).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/);
        if (!m) continue;
        instant = localToInstant(m[1], m[2], off);
      }
      if (isNaN(instant.getTime())) continue;
      const local = instantToLocal(instant, off);
      const emp = byDeviceId.get(uid);
      if (!emp) unmatched++;
      docs.push({
        employee: emp ? emp._id : null,
        deviceUserId: uid,
        punchTime: instant,
        date: local.date,
        time: local.time,
        deviceSerial: p.deviceSerial || '',
        branch: p.branch || emp?.branches?.[0] || '',
        source: p.source || 'device',
        verifyMode: p.verifyMode || '',
        punchState: p.punchState || '',
      });
    }

    let stored = 0;
    try {
      const res = await this.punchModel.insertMany(docs, { ordered: false });
      stored = res.length;
    } catch (e: any) {
      // Duplicate punches (device re-sends) are expected — keep the rest.
      stored = e?.insertedDocs?.length ?? e?.result?.nInserted ?? 0;
      if (e?.code !== 11000 && !e?.writeErrors) throw e;
    }

    const pairs = new Set(docs.filter((d) => d.employee).map((d) => `${d.employee}|${d.date}`));
    for (const key of pairs) {
      const [empId, date] = key.split('|');
      await this.processDay(empId, date).catch((err) => console.error('Attendance processing failed', empId, date, err?.message));
    }
    return { received: punches.length, stored, unmatched, processedDays: pairs.size };
  }

  // Remaps punches stored before an employee's device ID was set.
  async relinkUnmatched() {
    const ids = await this.punchModel.distinct('deviceUserId', { employee: null });
    if (!ids.length) return { relinked: 0 };
    const emps = await this.employeeModel.find({ $or: [{ deviceUserId: { $in: ids } }, { employeeId: { $in: ids } }] }).select('deviceUserId employeeId').lean();
    let relinked = 0;
    for (const e of emps) {
      const uid = e.deviceUserId || e.employeeId;
      const pending = await this.punchModel.find({ employee: null, deviceUserId: uid }).select('date').lean();
      if (!pending.length) continue;
      await this.punchModel.updateMany({ employee: null, deviceUserId: uid }, { $set: { employee: e._id } });
      relinked += pending.length;
      for (const date of new Set(pending.map((p) => p.date))) await this.processDay(String(e._id), date);
    }
    return { relinked };
  }

  async listPunches(query: any, actor: Actor) {
    const filter: any = {};
    if (query.date) filter.date = query.date;
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = query.from;
      if (query.to) filter.date.$lte = query.to;
    }
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (query.unmatched === 'true') filter.employee = null;
    if (query.device) filter.deviceSerial = query.device;
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) filter.branch = { $in: branches };
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(500, parseInt(query.limit, 10) || 50);
    const [total, data] = await Promise.all([
      this.punchModel.countDocuments(filter),
      this.punchModel.find(filter).sort({ punchTime: -1 }).skip((page - 1) * limit).limit(limit).populate('employee', 'name employeeId').lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  // ======================================================================
  // Day processing
  // ======================================================================

  private async expectedFor(emp: any, date: string, cfg: any): Promise<Expected> {
    const roster = await this.rosterModel.find({ employee: emp._id, date }).lean();
    const duties = roster.filter((r) => r.dutyType !== 'off');
    if (roster.some((r) => r.dutyType === 'off') && !duties.length) {
      return { start: '', end: '', source: 'roster', dayOff: 'weekend', offTitle: 'Roster day off' };
    }
    if (duties.length) {
      const starts = duties.map((d) => d.startTime).filter(Boolean).sort();
      const ends = duties.map((d) => d.endTime).filter(Boolean).sort();
      if (starts.length && ends.length) return { start: starts[0], end: ends[ends.length - 1], source: 'roster', dayOff: null };
    }

    const branchName = emp.branches?.[0];
    const branch = branchName ? await this.branchModel.findOne({ name: branchName }).select('_id').lean() : null;
    const branchIds = ['global', ...(branch ? [String(branch._id)] : [])];
    const overrides = await this.calendarModel.find({ dateStr: date, branchId: { $in: branchIds } }).lean();
    const override = overrides.find((o) => o.branchId !== 'global') || overrides.find((o) => o.branchId === 'global');

    const profile = this.profileTimes(emp, date, cfg);
    // A rostered duty overrides holidays/weekly offs (Friday duty etc.).
    if (!duties.length) {
      if (override && HOLIDAY_TYPES.includes(override.dayType)) return { ...profile, dayOff: 'holiday', offTitle: override.title || 'Holiday' };
      if (override?.dayType === 'weekly_off') return { ...profile, dayOff: 'weekend', offTitle: 'Weekly off' };
      if (!override) {
        const weeklies = await this.weeklyModel.find({ branchId: { $in: branchIds } }).lean();
        const weekly = weeklies.find((w) => w.branchId !== 'global') || weeklies[0];
        const day = weekly?.schedule?.[dayName(date)];
        if (day?.dayType === 'weekly_off') return { ...profile, dayOff: 'weekend', offTitle: 'Weekly off' };
      }
    }
    return { ...profile, dayOff: null };
  }

  private profileTimes(emp: any, date: string, cfg: any) {
    const dn = dayName(date);
    const sched = (emp.branchSchedules || []).find(
      (s: any) => s.inTime && s.outTime && (!s.days?.length || s.days.map((d: string) => d.toLowerCase()).includes(dn)),
    );
    if (sched) return { start: sched.inTime, end: sched.outTime, source: 'profile' };
    if (emp.dutyInTime && emp.dutyOutTime) return { start: emp.dutyInTime, end: emp.dutyOutTime, source: 'profile' };
    return { start: cfg.attendance.defaultInTime, end: cfg.attendance.defaultOutTime, source: 'default' };
  }

  async processDay(employeeId: string, date: string, opts: { force?: boolean } = {}) {
    const cfg = await this.access.getConfig();
    const a = cfg.attendance;
    const emp: any = await this.employeeModel.findById(employeeId).lean();
    if (!emp) return null;

    const existing = await this.recordModel.findOne({ employee: emp._id, date });
    if (existing?.isManual && !opts.force) return existing;

    const today = todayStr(a.timezoneOffsetMinutes);
    const punches = await this.punchModel.find({ employee: emp._id, date }).sort({ punchTime: 1 }).lean();
    const expected = await this.expectedFor(emp, date, cfg);
    const leave = await this.leaveModel
      .findOne({
        employee: emp._id,
        status: 'approved',
        $or: [
          { approvedFromDate: { $lte: date }, approvedToDate: { $gte: date } },
          { approvedFromDate: '', fromDate: { $lte: date }, toDate: { $gte: date } },
        ],
      })
      .lean();

    const rec: any = {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      designation: emp.jobPosition || '',
      branch: punches.find((p) => p.branch)?.branch || emp.branches?.[0] || '',
      date,
      shiftStart: expected.start,
      shiftEnd: expected.end,
      shiftSource: expected.source,
      inTime: '',
      outTime: '',
      punchCount: punches.length,
      isLate: false,
      lateMinutes: 0,
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      leaveTypeName: '',
      remarks: '',
      isManual: false,
      lastEditedBy: null,
    };

    if (!punches.length) {
      if (leave) {
        rec.status = 'leave';
        rec.leaveTypeName = leave.leaveTypeName;
      } else if (expected.dayOff) {
        rec.status = expected.dayOff;
        rec.remarks = expected.offTitle || '';
      } else if (date < today) {
        rec.status = 'absent';
      } else {
        // Today/future with no punch yet: nothing to record.
        if (existing && !existing.isManual) await existing.deleteOne();
        return null;
      }
    } else {
      const first = punches[0];
      const last = punches[punches.length - 1];
      const inMin = timeToMinutes(first.time)!;
      const lastMin = timeToMinutes(last.time)!;
      const hasOut = punches.length > 1 && lastMin - inMin >= a.minPunchGapMinutes;
      rec.inTime = first.time;
      rec.outTime = hasOut ? last.time : '';
      Object.assign(rec, this.computeMetrics(rec.inTime, rec.outTime, expected, cfg, date < today));
      if (leave) rec.remarks = `Punched in on approved leave (${leave.leaveTypeName})`;
    }

    return this.recordModel.findOneAndUpdate({ employee: emp._id, date }, { $set: rec }, { upsert: true, new: true });
  }

  // Derives status + minute counters from in/out times against the shift.
  private computeMetrics(inTime: string, outTime: string, expected: Expected, cfg: any, isPast: boolean) {
    const a = cfg.attendance;
    const inMin = timeToMinutes(inTime);
    const outMinRaw = timeToMinutes(outTime);
    const start = timeToMinutes(expected.start);
    let end = timeToMinutes(expected.end);
    if (start !== null && end !== null && end <= start) end += 1440; // overnight shift
    let outMin = outMinRaw;
    if (outMin !== null && inMin !== null && outMin < inMin) outMin += 1440;

    const r: any = { isLate: false, lateMinutes: 0, isEarlyLeave: false, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
    if (inMin === null) return { ...r, status: isPast ? 'absent' : 'present' };

    if (outMin !== null) r.workedMinutes = Math.max(0, outMin - inMin);

    if (expected.dayOff) {
      // Worked on an off day / holiday: all of it counts as overtime.
      r.overtimeMinutes = r.workedMinutes;
      r.status = outMin === null && isPast ? 'missing_punch' : 'present';
      r.remarks = `Worked on ${expected.dayOff === 'holiday' ? 'holiday' : 'day off'}`;
      return r;
    }

    if (start !== null && inMin > start + a.graceMinutes) {
      r.isLate = true;
      r.lateMinutes = inMin - start;
    }
    if (outMin !== null && end !== null) {
      if (outMin < end - a.earlyLeaveToleranceMinutes) {
        r.isEarlyLeave = true;
        r.earlyLeaveMinutes = end - outMin;
      }
      const ot = outMin - end;
      if (ot >= a.overtimeAfterMinutes) r.overtimeMinutes = ot;
    }

    if (outMin === null) r.status = isPast ? 'missing_punch' : r.isLate ? 'late' : 'present';
    else if (r.workedMinutes < a.halfDayMinutes) r.status = 'half_day';
    else r.status = r.isLate ? 'late' : 'present';
    return r;
  }

  // Processes a whole date for every active employee (absent marking etc.).
  async processDate(date: string, opts: { branch?: string; force?: boolean } = {}) {
    if (!isDateStr(date)) throw new BadRequestException('date must be YYYY-MM-DD');
    const filter: any = { status: { $nin: INACTIVE_STATUSES } };
    if (opts.branch && opts.branch !== 'all') filter.branches = opts.branch;
    const emps = await this.employeeModel.find(filter).select('_id joiningDate').lean();
    let processed = 0;
    for (const e of emps) {
      if (e.joiningDate && e.joiningDate > date) continue;
      await this.processDay(String(e._id), date, { force: opts.force });
      processed++;
    }
    return { date, processed };
  }

  // ======================================================================
  // Queries
  // ======================================================================

  // Daily board: every in-scope active employee with their record for the
  // date; employees with no record yet show as "not_punched".
  async daily(query: any, actor: Actor) {
    const off = await this.offset();
    const date = isDateStr(query.date) ? query.date : todayStr(off);
    const empFilter: any = { status: { $nin: INACTIVE_STATUSES } };
    if (actor.scope === 'self') empFilter._id = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) empFilter.branches = { $in: branches };
    }
    if (query.department && query.department !== 'all') empFilter.department = query.department;
    if (query.search) {
      empFilter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
      ];
    }
    const emps = await this.employeeModel.find(empFilter).select('name employeeId jobPosition department branches photo joiningDate').sort({ name: 1 }).lean();
    const records = await this.recordModel.find({ date, employee: { $in: emps.map((e) => e._id) } }).lean();
    const recMap = new Map(records.map((r) => [String(r.employee), r]));

    let rows = emps
      .filter((e) => !e.joiningDate || e.joiningDate <= date)
      .map((e) => {
        const r: any = recMap.get(String(e._id));
        return {
          _id: r?._id || null,
          employee: { _id: e._id, name: e.name, employeeId: e.employeeId, jobPosition: e.jobPosition, department: e.department, photo: e.photo },
          branch: r?.branch || e.branches?.[0] || '',
          date,
          status: r?.status || 'not_punched',
          inTime: r?.inTime || '',
          outTime: r?.outTime || '',
          shiftStart: r?.shiftStart || '',
          shiftEnd: r?.shiftEnd || '',
          lateMinutes: r?.lateMinutes || 0,
          isLate: !!r?.isLate,
          isEarlyLeave: !!r?.isEarlyLeave,
          earlyLeaveMinutes: r?.earlyLeaveMinutes || 0,
          workedMinutes: r?.workedMinutes || 0,
          overtimeMinutes: r?.overtimeMinutes || 0,
          punchCount: r?.punchCount || 0,
          leaveTypeName: r?.leaveTypeName || '',
          remarks: r?.remarks || '',
          isManual: !!r?.isManual,
          lastEditedBy: r?.lastEditedBy || null,
        };
      });

    const summary = this.summarize(rows);
    if (query.status && query.status !== 'all') {
      if (query.status === 'late') rows = rows.filter((r) => r.isLate);
      else if (query.status === 'early_leave') rows = rows.filter((r) => r.isEarlyLeave);
      else if (query.status === 'overtime') rows = rows.filter((r) => r.overtimeMinutes > 0);
      else rows = rows.filter((r) => r.status === query.status);
    }
    return { date, summary, data: rows };
  }

  private summarize(rows: any[]) {
    const s: any = { total: rows.length, present: 0, late: 0, absent: 0, leave: 0, halfDay: 0, missingPunch: 0, earlyLeave: 0, overtime: 0, weekend: 0, holiday: 0, notPunched: 0 };
    for (const r of rows) {
      if (WORKED_STATUSES.includes(r.status)) s.present++;
      if (r.isLate) s.late++;
      if (r.isEarlyLeave) s.earlyLeave++;
      if (r.overtimeMinutes > 0) s.overtime++;
      if (r.status === 'absent') s.absent++;
      if (r.status === 'leave') s.leave++;
      if (r.status === 'half_day') s.halfDay++;
      if (r.status === 'missing_punch') s.missingPunch++;
      if (r.status === 'weekend') s.weekend++;
      if (r.status === 'holiday') s.holiday++;
      if (r.status === 'not_punched') s.notPunched++;
    }
    return s;
  }

  async records(query: any, actor: Actor) {
    const filter: any = {};
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = query.from;
      if (query.to) filter.date.$lte = query.to;
    }
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) filter.branch = { $in: branches };
    }
    return this.recordModel.find(filter).sort({ date: -1, employeeName: 1 }).limit(5000).lean();
  }

  // Month summary per employee (branch-wise or combined).
  async monthlyReport(query: any, actor: Actor) {
    const month = isMonthStr(query.month) ? query.month : todayStr(await this.offset()).slice(0, 7);
    const { from, to, days } = monthRange(month);
    const match: any = { date: { $gte: from, $lte: to } };
    if (actor.scope === 'self') match.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) match.branch = { $in: branches };
    }
    if (query.employee) match.employee = new Types.ObjectId(query.employee);
    if (actor.scope === 'self') match.employee = new Types.ObjectId(actor.id);
    const rows = await this.recordModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employee',
          employeeName: { $first: '$employeeName' },
          employeeCode: { $first: '$employeeCode' },
          designation: { $first: '$designation' },
          branch: { $first: '$branch' },
          present: { $sum: { $cond: [{ $in: ['$status', WORKED_STATUSES] }, 1, 0] } },
          late: { $sum: { $cond: ['$isLate', 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          missingPunch: { $sum: { $cond: [{ $eq: ['$status', 'missing_punch'] }, 1, 0] } },
          weekend: { $sum: { $cond: [{ $eq: ['$status', 'weekend'] }, 1, 0] } },
          holiday: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
          earlyLeave: { $sum: { $cond: ['$isEarlyLeave', 1, 0] } },
          lateMinutes: { $sum: '$lateMinutes' },
          workedMinutes: { $sum: '$workedMinutes' },
          overtimeMinutes: { $sum: '$overtimeMinutes' },
        },
      },
      { $sort: { branch: 1, employeeName: 1 } },
    ]);
    return { month, from, to, days, data: rows };
  }

  async my(month: string, actor: Actor) {
    const m = isMonthStr(month) ? month : todayStr(await this.offset()).slice(0, 7);
    const { from, to } = monthRange(m);
    const data = await this.recordModel.find({ employee: new Types.ObjectId(actor.id), date: { $gte: from, $lte: to } }).sort({ date: -1 }).lean();
    return { month: m, summary: this.summarize(data), data };
  }

  // ======================================================================
  // Manual correction (audited)
  // ======================================================================

  async correct(dto: any, actor: Actor, ip = '') {
    if (!dto.reason || !String(dto.reason).trim()) throw new BadRequestException('A reason is required for every attendance correction');
    if (dto.status && !ATTENDANCE_STATUSES.includes(dto.status)) throw new BadRequestException('Invalid status');
    for (const t of [dto.inTime, dto.outTime]) if (t && timeToMinutes(t) === null) throw new BadRequestException('Times must be HH:mm');

    let record = dto.recordId ? await this.recordModel.findById(dto.recordId) : null;
    if (!record) {
      if (!dto.employeeId || !isDateStr(dto.date)) throw new BadRequestException('employeeId and date are required');
      record = await this.recordModel.findOne({ employee: new Types.ObjectId(dto.employeeId), date: dto.date });
    }
    const empId = record ? String(record.employee) : dto.employeeId;
    const date = record ? record.date : dto.date;
    const emp: any = await this.employeeModel.findById(empId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    if (String(emp._id) === actor.id && !actor.isSuperAdmin) throw new ForbiddenException('You cannot correct your own attendance');
    this.access.assertCanAccess(actor, String(emp._id), record?.branch || emp.branches);
    if (actor.scope === 'self') throw new ForbiddenException('Not allowed');

    const cfg = await this.access.getConfig();
    const before = record ? { status: record.status, inTime: record.inTime, outTime: record.outTime, remarks: record.remarks } : null;
    const expected = await this.expectedFor(emp, date, cfg);
    const inTime = dto.inTime !== undefined ? dto.inTime : record?.inTime || '';
    const outTime = dto.outTime !== undefined ? dto.outTime : record?.outTime || '';
    const isPast = date < todayStr(cfg.attendance.timezoneOffsetMinutes);
    const metrics = inTime ? this.computeMetrics(inTime, outTime, expected, cfg, isPast) : { status: 'absent', isLate: false, lateMinutes: 0, isEarlyLeave: false, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
    const status = dto.status || metrics.status;
    // An explicit non-working status clears the computed counters.
    const zero = ['absent', 'leave', 'weekend', 'holiday'].includes(status);

    const set: any = {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      designation: emp.jobPosition || '',
      branch: record?.branch || emp.branches?.[0] || '',
      date,
      shiftStart: expected.start,
      shiftEnd: expected.end,
      shiftSource: expected.source,
      inTime: zero ? '' : inTime,
      outTime: zero ? '' : outTime,
      punchCount: record?.punchCount || 0,
      status,
      isLate: zero ? false : metrics.isLate,
      lateMinutes: zero ? 0 : metrics.lateMinutes,
      isEarlyLeave: zero ? false : metrics.isEarlyLeave,
      earlyLeaveMinutes: zero ? 0 : metrics.earlyLeaveMinutes,
      workedMinutes: zero ? 0 : metrics.workedMinutes,
      overtimeMinutes: zero ? 0 : dto.overtimeMinutes !== undefined ? Number(dto.overtimeMinutes) || 0 : metrics.overtimeMinutes,
      leaveTypeName: status === 'leave' ? dto.leaveTypeName || record?.leaveTypeName || 'Leave' : '',
      remarks: dto.remarks !== undefined ? dto.remarks : record?.remarks || '',
      isManual: true,
      lastEditedBy: { id: actor.id, name: actor.name, role: actor.role, at: new Date() },
    };
    const saved = await this.recordModel.findOneAndUpdate({ employee: emp._id, date }, { $set: set }, { upsert: true, new: true });

    await this.correctionModel.create({
      record: saved._id,
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      branch: saved.branch,
      date,
      before,
      after: { status: saved.status, inTime: saved.inTime, outTime: saved.outTime, remarks: saved.remarks },
      reason: String(dto.reason).trim(),
      editedBy: { id: actor.id, name: actor.name, role: actor.role },
      ipAddress: ip,
    });
    return saved;
  }

  // Drops a manual override and recomputes from raw punches.
  async resetToDevice(recordId: string, reason: string, actor: Actor) {
    const record = await this.recordModel.findById(recordId);
    if (!record) throw new NotFoundException('Record not found');
    this.access.assertCanAccess(actor, String(record.employee), record.branch);
    const before = { status: record.status, inTime: record.inTime, outTime: record.outTime, remarks: record.remarks };
    const after: any = await this.processDay(String(record.employee), record.date, { force: true });
    await this.correctionModel.create({
      record: record._id,
      employee: record.employee,
      employeeName: record.employeeName,
      employeeCode: record.employeeCode,
      branch: record.branch,
      date: record.date,
      before,
      after: after ? { status: after.status, inTime: after.inTime, outTime: after.outTime, remarks: after.remarks } : null,
      reason: reason || 'Reset to device data',
      editedBy: { id: actor.id, name: actor.name, role: actor.role },
    });
    return after;
  }

  async corrections(query: any, actor: Actor) {
    const filter: any = {};
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = query.from;
      if (query.to) filter.date.$lte = query.to;
    }
    if (query.editor) filter['editedBy.id'] = query.editor;
    if (actor.scope === 'self') filter.employee = new Types.ObjectId(actor.id);
    else {
      const branches = this.access.resolveBranchFilter(actor, query.branch);
      if (branches) filter.branch = { $in: branches };
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, parseInt(query.limit, 10) || 30);
    const [total, data] = await Promise.all([
      this.correctionModel.countDocuments(filter),
      this.correctionModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  // Used by payroll: per-employee month aggregate keyed by employee id.
  async monthAggregate(month: string, employeeIds: string[]) {
    const { from, to } = monthRange(month);
    const rows = await this.recordModel.aggregate([
      { $match: { date: { $gte: from, $lte: to }, employee: { $in: employeeIds.map((id) => new Types.ObjectId(id)) } } },
      {
        $group: {
          _id: '$employee',
          present: { $sum: { $cond: [{ $in: ['$status', WORKED_STATUSES] }, 1, 0] } },
          late: { $sum: { $cond: ['$isLate', 1, 0] } },
          lateMinutes: { $sum: '$lateMinutes' },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          missingPunch: { $sum: { $cond: [{ $eq: ['$status', 'missing_punch'] }, 1, 0] } },
          weekend: { $sum: { $cond: [{ $eq: ['$status', 'weekend'] }, 1, 0] } },
          holiday: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
          overtimeMinutes: { $sum: '$overtimeMinutes' },
        },
      },
    ]);
    return new Map(rows.map((r) => [String(r._id), r]));
  }
}
