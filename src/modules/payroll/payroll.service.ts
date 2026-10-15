import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { LatePolicy, LatePolicyDocument } from '../late-policy/schemas/late-policy.schema';
import { OvertimePolicy, OvertimePolicyDocument } from '../overtime/schemas/overtime-policy.schema';
import { LeaveType, LeaveTypeDocument } from '../leave-type/schemas/leave-type.schema';
import {
  EmployeeLoan,
  EmployeeLoanDocument,
  PayrollAdjustment,
  PayrollAdjustmentDocument,
  PayrollRun,
  PayrollRunDocument,
  Payslip,
  PayslipDocument,
  SalaryStructure,
  SalaryStructureDocument,
} from './schemas/payroll.schema';
import { AttendanceRecord, AttendanceRecordDocument } from '../attendance/schemas/attendance.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { AttendanceService } from '../attendance/attendance.service';
import { EmployeeHistoryService } from '../employee-history/employee-history.service';
import { diffDays, isDateStr, isMonthStr, monthRange, todayStr } from '../../common/helpers/hr-date.helper';
import { createWithRefNo } from '../../common/helpers/ref-no.helper';

const INACTIVE = ['inactive'];
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (list: Array<{ amount: number }> = []) => list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
const cleanList = (list: any) =>
  (Array.isArray(list) ? list : [])
    .filter((x) => x && String(x.name || '').trim() && Number(x.amount) >= 0)
    .map((x) => ({ name: String(x.name).trim(), amount: round(x.amount) }));

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(SalaryStructure.name) private readonly structureModel: Model<SalaryStructureDocument>,
    @InjectModel(EmployeeLoan.name) private readonly loanModel: Model<EmployeeLoanDocument>,
    @InjectModel(PayrollAdjustment.name) private readonly adjustmentModel: Model<PayrollAdjustmentDocument>,
    @InjectModel(PayrollRun.name) private readonly runModel: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly payslipModel: Model<PayslipDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(LatePolicy.name) private readonly latePolicyModel: Model<LatePolicyDocument>,
    @InjectModel(OvertimePolicy.name) private readonly overtimePolicyModel: Model<OvertimePolicyDocument>,
    @InjectModel(LeaveType.name) private readonly leaveTypeModel: Model<LeaveTypeDocument>,
    @InjectModel(AttendanceRecord.name) private readonly recordModel: Model<AttendanceRecordDocument>,
    private readonly access: HrAccessService,
    private readonly attendance: AttendanceService,
    private readonly history: EmployeeHistoryService,
  ) {}

  private assertPayrollAccess(actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Payroll is restricted to HR/management');
  }

  // ======================================================================
  // Salary structures
  // ======================================================================

  // Every in-scope employee with their structure (or a stub from profile).
  async listStructures(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const filter: any = { status: { $nin: ['inactive', 'terminated', 'resigned'] } };
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branches = { $in: branches };
    if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }, { employeeId: { $regex: query.search, $options: 'i' } }];
    const emps = await this.employeeModel.find(filter).select('name employeeId jobPosition department branches basicSalary grossSalary photo').sort({ name: 1 }).lean();
    const structures = await this.structureModel.find({ employee: { $in: emps.map((e) => e._id) } }).lean();
    const map = new Map(structures.map((s) => [String(s.employee), s]));
    return emps.map((e) => ({ employee: e, structure: map.get(String(e._id)) || null }));
  }

  async getStructure(employeeId: string, actor: Actor) {
    const emp = await this.employeeModel.findById(employeeId).select('name employeeId branches basicSalary grossSalary').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    if (employeeId !== actor.id) {
      this.assertPayrollAccess(actor);
      this.access.assertCanAccess(actor, employeeId, emp.branches);
    }
    return this.structureModel.findOne({ employee: emp._id }).lean();
  }

  async saveStructure(employeeId: string, dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const emp = await this.employeeModel.findById(employeeId);
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, employeeId, emp.branches);
    if (dto.effectiveFrom && !isDateStr(dto.effectiveFrom)) throw new BadRequestException('effectiveFrom must be YYYY-MM-DD');

    const values = {
      basic: round(dto.basic),
      houseRent: round(dto.houseRent),
      medical: round(dto.medical),
      conveyance: round(dto.conveyance),
      otherAllowances: cleanList(dto.otherAllowances),
      fixedDeductions: cleanList(dto.fixedDeductions),
    };
    if (values.basic <= 0) throw new BadRequestException('Basic salary must be greater than 0');
    const gross = round(values.basic + values.houseRent + values.medical + values.conveyance + sum(values.otherAllowances));

    let doc = await this.structureModel.findOne({ employee: emp._id });
    const previousGross = doc?.gross || emp.grossSalary || 0;
    const previousBasic = doc?.basic || emp.basicSalary || 0;
    const effectiveFrom = dto.effectiveFrom || todayStr();
    const changed = !doc || previousGross !== gross || previousBasic !== values.basic;
    const hadSalary = previousGross > 0 || previousBasic > 0;
    const type = !hadSalary ? 'initial' : gross > previousGross ? (dto.revisionType === 'revision' ? 'revision' : 'increment') : gross < previousGross ? 'decrement' : 'revision';

    if (!doc) doc = new this.structureModel({ employee: emp._id, revisions: [] });
    Object.assign(doc, values, {
      gross,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      branch: emp.branches?.[0] || '',
      paymentMode: dto.paymentMode || doc.paymentMode || 'cash',
      accountNumber: dto.accountNumber ?? doc.accountNumber ?? '',
      effectiveFrom,
    });
    if (changed) {
      doc.revisions.push({ type, effectiveFrom, previousBasic, newBasic: values.basic, previousGross, newGross: gross, remarks: dto.remarks || '', by: { id: actor.id, name: actor.name }, at: new Date() } as any);
      doc.markModified('revisions');
    }
    await doc.save();

    // Keep profile headline figures in sync without double-recording history.
    await this.employeeModel.updateOne({ _id: emp._id }, { $set: { basicSalary: values.basic, grossSalary: gross } });
    if (changed && (previousGross > 0 || previousBasic > 0)) {
      await this.history.record({
        employeeId,
        eventType: type === 'increment' ? 'increment' : 'salary_revision',
        effectiveDate: effectiveFrom,
        description: dto.remarks || `Gross ${previousGross} → ${gross}`,
        from: { basicSalary: previousBasic, grossSalary: previousGross, designation: emp.jobPosition, branches: emp.branches },
        to: { basicSalary: values.basic, grossSalary: gross, designation: emp.jobPosition, branches: emp.branches },
        referenceNo: dto.referenceNo || '',
        sourceModule: 'payroll',
        sourceId: String(doc._id),
        recordedBy: { id: actor.id, name: actor.name, role: actor.role },
      });
    }
    return doc;
  }

  // ======================================================================
  // Advances & loans
  // ======================================================================

  async listLoans(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const filter: any = {};
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branch = { $in: branches };
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.type && query.type !== 'all') filter.type = query.type;
    if (query.employee) filter.employee = new Types.ObjectId(query.employee);
    const data = await this.loanModel.find(filter).sort({ createdAt: -1 }).lean();
    const outstanding = data.filter((l) => l.status === 'active').reduce((s, l) => s + (l.amount - l.recoveredAmount), 0);
    return { data, stats: { total: data.length, active: data.filter((l) => l.status === 'active').length, outstanding: round(outstanding) } };
  }

  async createLoan(dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const emp = await this.employeeModel.findById(dto.employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    const amount = round(dto.amount);
    const installment = round(dto.installmentAmount || amount);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than 0');
    if (installment <= 0 || installment > amount) throw new BadRequestException('Installment must be between 1 and the amount');
    if (!isMonthStr(dto.startMonth)) throw new BadRequestException('startMonth must be YYYY-MM');
    const prefix = dto.type === 'loan' ? 'LN' : dto.type === 'adjustment' ? 'ADJ' : 'ADV';
    return createWithRefNo(this.loanModel, 'loanNo', prefix, {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      branch: emp.branches?.[0] || '',
      type: ['advance', 'loan', 'adjustment'].includes(dto.type) ? dto.type : 'advance',
      amount,
      installmentAmount: installment,
      startMonth: dto.startMonth,
      reason: dto.reason || '',
      disbursedOn: dto.disbursedOn || todayStr(),
      approvedBy: { id: actor.id, name: actor.name },
    });
  }

  async updateLoan(id: string, dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');
    this.access.assertCanAccess(actor, String(loan.employee), loan.branch);
    if (dto.status === 'cancelled') {
      if (loan.recoveredAmount > 0) throw new BadRequestException('A loan with recoveries cannot be cancelled — mark it completed instead');
      loan.status = 'cancelled';
    } else if (dto.status === 'completed') loan.status = 'completed';
    if (dto.installmentAmount !== undefined) {
      const inst = round(dto.installmentAmount);
      if (inst <= 0) throw new BadRequestException('Installment must be greater than 0');
      loan.installmentAmount = inst;
    }
    if (dto.reason !== undefined) loan.reason = dto.reason;
    await loan.save();
    return loan;
  }

  // ======================================================================
  // Monthly adjustments (bonus etc.)
  // ======================================================================

  async listAdjustments(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const filter: any = {};
    if (query.month) filter.month = query.month;
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) filter.branch = { $in: branches };
    return this.adjustmentModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async createAdjustments(dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    if (!isMonthStr(dto.month)) throw new BadRequestException('month must be YYYY-MM');
    const ids: string[] = Array.isArray(dto.employeeIds) ? dto.employeeIds : [dto.employeeId];
    const amount = round(dto.amount);
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than 0');
    if (!dto.title) throw new BadRequestException('Title is required');
    const emps = await this.employeeModel.find({ _id: { $in: ids.filter(Boolean) } }).lean();
    const docs: any[] = [];
    for (const emp of emps) {
      this.access.assertCanAccess(actor, String(emp._id), emp.branches);
      await this.assertMonthOpen(dto.month, emp.branches?.[0]);
      docs.push({
        employee: emp._id,
        employeeName: emp.name,
        employeeCode: emp.employeeId || '',
        branch: emp.branches?.[0] || '',
        month: dto.month,
        type: dto.type,
        title: dto.title,
        amount,
        note: dto.note || '',
        createdBy: { id: actor.id, name: actor.name },
      });
    }
    return this.adjustmentModel.insertMany(docs);
  }

  async removeAdjustment(id: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const doc = await this.adjustmentModel.findById(id);
    if (!doc) throw new NotFoundException('Adjustment not found');
    await this.assertMonthOpen(doc.month, doc.branch);
    await doc.deleteOne();
    return { message: 'Adjustment removed' };
  }

  private async assertMonthOpen(month: string, branch?: string) {
    const locked = await this.runModel.findOne({ month, status: { $ne: 'draft' }, branch: { $in: ['all', branch || ''] } }).lean();
    if (locked) throw new BadRequestException(`Payroll for ${month} is already ${locked.status}`);
  }

  // ======================================================================
  // Payroll runs
  // ======================================================================

  async listRuns(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const filter: any = {};
    if (query.year) filter.month = { $regex: `^${query.year}-` };
    if (actor.scope === 'branch') filter.branch = { $in: actor.branches };
    return this.runModel.find(filter).sort({ month: -1, branch: 1 }).lean();
  }

  async getRun(id: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const run = await this.runModel.findById(id).lean();
    if (!run) throw new NotFoundException('Payroll run not found');
    if (actor.scope === 'branch' && !actor.branches.includes(run.branch)) throw new ForbiddenException('Not your branch');
    const payslips = await this.payslipModel.find({ run: run._id }).sort({ branch: 1, employeeName: 1 }).lean();
    return { run, payslips };
  }

  async generate(dto: { month: string; branch?: string }, actor: Actor) {
    this.assertPayrollAccess(actor);
    if (!isMonthStr(dto.month)) throw new BadRequestException('month must be YYYY-MM');
    const branch = dto.branch && dto.branch !== 'all' ? dto.branch : 'all';
    if (actor.scope === 'branch' && (branch === 'all' || !actor.branches.includes(branch))) {
      throw new ForbiddenException('You can only run payroll for your own branch');
    }

    // Never let an employee land in both a combined and a branch run.
    const clash = await this.runModel.findOne(branch === 'all' ? { month: dto.month, branch: { $ne: 'all' } } : { month: dto.month, branch: 'all' }).lean();
    if (clash) throw new ConflictException(branch === 'all' ? `Branch-wise payroll already exists for ${dto.month} (${clash.branch})` : `A combined payroll already exists for ${dto.month}`);

    let run = await this.runModel.findOne({ month: dto.month, branch });
    if (run && run.status !== 'draft') throw new BadRequestException(`Payroll ${dto.month} (${branch}) is already ${run.status}`);
    if (!run) run = await this.runModel.create({ month: dto.month, branch, status: 'draft', generatedBy: { id: actor.id, name: actor.name } });
    else run.generatedBy = { id: actor.id, name: actor.name };

    const { from, to, days: calendarDays } = monthRange(dto.month);
    const cfg = await this.access.getConfig();
    const daysInMonth = cfg.payroll.daysBasis === 'fixed30' ? 30 : calendarDays;

    const empFilter: any = { status: { $nin: INACTIVE } };
    if (branch !== 'all') empFilter['branches.0'] = branch;
    const emps = (await this.employeeModel.find(empFilter).lean()).filter(
      (e) =>
        (!e.joiningDate || e.joiningDate <= to) &&
        (!e.lastWorkingDate || e.lastWorkingDate >= from) &&
        // Separated staff are only paid up to a recorded last working day.
        !(['resigned', 'terminated'].includes(e.status) && !e.lastWorkingDate),
    );
    const empIds = emps.map((e) => String(e._id));

    const [structures, attendanceMap, latePolicy, otPolicy, unpaidTypes, adjustments, loans] = await Promise.all([
      this.structureModel.find({ employee: { $in: emps.map((e) => e._id) } }).lean(),
      this.attendance.monthAggregate(dto.month, empIds),
      this.latePolicyModel.findOne({ status: 'active' }).lean(),
      this.overtimePolicyModel.findOne({ status: 'active' }).lean(),
      this.leaveTypeModel.find({ isPaid: 'no' }).select('name').lean(),
      this.adjustmentModel.find({ month: dto.month, employee: { $in: emps.map((e) => e._id) } }).lean(),
      this.loanModel.find({ status: 'active', startMonth: { $lte: dto.month }, employee: { $in: emps.map((e) => e._id) } }).lean(),
    ]);
    const unpaidNames = unpaidTypes.map((t) => t.name);
    const unpaidLeave = unpaidNames.length
      ? await this.recordModel.aggregate([
          { $match: { date: { $gte: from, $lte: to }, status: 'leave', leaveTypeName: { $in: unpaidNames }, employee: { $in: emps.map((e) => e._id) } } },
          { $group: { _id: '$employee', n: { $sum: 1 } } },
        ])
      : [];
    const unpaidMap = new Map(unpaidLeave.map((u) => [String(u._id), u.n]));
    const lateMinutesByEmp = latePolicy?.deductionType === 'per_minute' ? await this.lateMinutesBeyondAllowance(from, to, emps, latePolicy) : new Map<string, number>();
    const structMap = new Map(structures.map((s) => [String(s.employee), s]));

    // Keep manual edits of a draft across regenerations? No — regenerate is
    // an explicit "recalculate everything"; drop the old draft payslips.
    await this.payslipModel.deleteMany({ run: run._id });

    const skipped: string[] = [];
    const slips: any[] = [];
    for (const emp of emps) {
      const st: any = structMap.get(String(emp._id));
      const basicFull = st?.basic || emp.basicSalary || 0;
      const grossFull = st?.gross || emp.grossSalary || basicFull;
      if (!grossFull) {
        skipped.push(`${emp.name} (${emp.employeeId || 'no ID'}) — no salary set`);
        continue;
      }

      // Pro-rate for joining / leaving inside the month.
      const startD = emp.joiningDate && emp.joiningDate > from ? emp.joiningDate : from;
      const endD = emp.lastWorkingDate && emp.lastWorkingDate < to ? emp.lastWorkingDate : to;
      const eligible = Math.max(0, diffDays(startD, endD) + 1);
      const factor = eligible >= calendarDays ? 1 : eligible / calendarDays;

      const basic = round(basicFull * factor);
      const houseRent = round((st?.houseRent || 0) * factor);
      const medical = round((st?.medical || 0) * factor);
      const conveyance = round((st?.conveyance || 0) * factor);
      const other = round((st ? sum(st.otherAllowances) : Math.max(0, grossFull - basicFull)) * factor);
      const gross = round(st ? basic + houseRent + medical + conveyance + other : grossFull * factor);

      const att: any = attendanceMap.get(String(emp._id)) || {};
      const perDay = ((cfg.payroll.perDayBasis === 'basic' ? basicFull : grossFull) || 0) / daysInMonth;
      const absent = att.absent || 0;
      const halfDay = att.halfDay || 0;
      const unpaid = unpaidMap.get(String(emp._id)) || 0;
      const absentDeduction = round((absent + unpaid + halfDay * 0.5) * perDay);

      // Late deduction per the active late policy.
      let lateDeduction = 0;
      const late = att.late || 0;
      if (latePolicy && late > 0) {
        const allowed = latePolicy.maxLateAllowedPerMonth || 0;
        const beyond = Math.max(0, late - allowed);
        if (latePolicy.deductionType === 'fixed') lateDeduction = beyond * (latePolicy.deductionAmount || 0);
        else if (latePolicy.deductionType === 'per_minute') lateDeduction = (lateMinutesByEmp.get(String(emp._id)) || 0) * (latePolicy.deductionAmount || 0);
        else lateDeduction = Math.floor(late / Math.max(1, allowed || 3)) * perDay; // per_day / salary_wise: N lates = 1 day
      }
      lateDeduction = round(lateDeduction);

      // Overtime.
      const otRate = otPolicy?.ratePerHour || 1.5;
      const maxOt = otPolicy?.maxHoursPerMonth || 9999;
      const overtimeHours = round(Math.min(maxOt, (att.overtimeMinutes || 0) / 60));
      const hourly = basicFull / (daysInMonth * (cfg.payroll.standardHoursPerDay || 8));
      const overtimePay = round(overtimeHours * hourly * otRate);

      const lines: any[] = [];
      const empAdj = adjustments.filter((a) => String(a.employee) === String(emp._id));
      let bonus = 0;
      let otherEarnings = 0;
      let otherDeductions = 0;
      for (const a of empAdj) {
        if (a.type === 'bonus' || a.type === 'incentive') bonus += a.amount;
        else if (a.type === 'deduction') otherDeductions += a.amount;
        else otherEarnings += a.amount;
        lines.push({ kind: a.type === 'deduction' ? 'deduction' : 'earning', label: a.title, amount: a.amount, ref: String(a._id) });
      }

      let advanceDeduction = 0;
      let loanDeduction = 0;
      for (const l of loans.filter((x) => String(x.employee) === String(emp._id))) {
        const remaining = round(l.amount - l.recoveredAmount);
        const ded = Math.min(l.installmentAmount, remaining);
        if (ded <= 0) continue;
        if (l.type === 'advance') advanceDeduction += ded;
        else loanDeduction += ded;
        lines.push({ kind: 'deduction', label: `${l.type === 'advance' ? 'Advance' : 'Loan'} ${l.loanNo}`, amount: ded, ref: String(l._id) });
      }

      const fixedDeductions = round(st ? sum(st.fixedDeductions) : 0);
      for (const f of st?.fixedDeductions || []) lines.push({ kind: 'deduction', label: f.name, amount: f.amount });

      const totalEarnings = round(gross + overtimePay + bonus + otherEarnings);
      const totalDeductions = round(lateDeduction + absentDeduction + advanceDeduction + loanDeduction + fixedDeductions + otherDeductions);
      const remarks: string[] = [];
      if (factor < 1) remarks.push(`Pro-rated ${eligible}/${calendarDays} days`);
      if (!attendanceMap.has(String(emp._id))) remarks.push('No attendance data for this month');

      slips.push({
        run: run._id,
        month: dto.month,
        employee: emp._id,
        employeeName: emp.name,
        employeeCode: emp.employeeId || '',
        designation: emp.jobPosition || '',
        department: emp.department || '',
        branch: emp.branches?.[0] || '',
        paymentMode: st?.paymentMode || 'cash',
        accountNumber: st?.accountNumber || '',
        attendance: {
          daysInMonth,
          present: att.present || 0,
          absent,
          late,
          lateMinutes: att.lateMinutes || 0,
          halfDay,
          leave: att.leave || 0,
          unpaidLeave: unpaid,
          weekend: att.weekend || 0,
          holiday: att.holiday || 0,
          overtimeHours,
        },
        basic,
        houseRent,
        medical,
        conveyance,
        otherAllowances: other,
        gross,
        overtimePay,
        bonus: round(bonus),
        otherEarnings: round(otherEarnings),
        totalEarnings,
        lateDeduction,
        absentDeduction,
        advanceDeduction: round(advanceDeduction),
        loanDeduction: round(loanDeduction),
        fixedDeductions,
        otherDeductions: round(otherDeductions),
        totalDeductions,
        netSalary: Math.round(Math.max(0, totalEarnings - totalDeductions)),
        lines,
        remarks: remarks.join('; '),
      });
    }
    if (slips.length) await this.payslipModel.insertMany(slips);
    await this.refreshTotals(run);
    return { run, generated: slips.length, skipped };
  }

  private async lateMinutesBeyondAllowance(from: string, to: string, emps: any[], policy: any) {
    const recs = await this.recordModel
      .find({ date: { $gte: from, $lte: to }, isLate: true, employee: { $in: emps.map((e) => e._id) } })
      .select('employee date lateMinutes')
      .sort({ date: 1 })
      .lean();
    const byEmp = new Map<string, number[]>();
    for (const r of recs) {
      const k = String(r.employee);
      if (!byEmp.has(k)) byEmp.set(k, []);
      byEmp.get(k)!.push(r.lateMinutes || 0);
    }
    const out = new Map<string, number>();
    for (const [k, mins] of byEmp) out.set(k, mins.slice(policy.maxLateAllowedPerMonth || 0).reduce((s, m) => s + m, 0));
    return out;
  }

  private async refreshTotals(run: any) {
    const agg = await this.payslipModel.aggregate([
      { $match: { run: run._id } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          gross: { $sum: '$gross' },
          overtimePay: { $sum: '$overtimePay' },
          bonus: { $sum: '$bonus' },
          otherEarnings: { $sum: '$otherEarnings' },
          totalEarnings: { $sum: '$totalEarnings' },
          lateDeduction: { $sum: '$lateDeduction' },
          absentDeduction: { $sum: '$absentDeduction' },
          advanceDeduction: { $sum: '$advanceDeduction' },
          loanDeduction: { $sum: '$loanDeduction' },
          fixedDeductions: { $sum: '$fixedDeductions' },
          otherDeductions: { $sum: '$otherDeductions' },
          totalDeductions: { $sum: '$totalDeductions' },
          netSalary: { $sum: '$netSalary' },
        },
      },
    ]);
    const t = agg[0] || { count: 0 };
    const { _id, count, ...totals } = t;
    run.totals = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v as number)]));
    run.employeeCount = count || 0;
    run.markModified('totals');
    await run.save();
    return run;
  }

  // Manual edit of a draft payslip's free-form items.
  async updatePayslip(id: string, dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    const slip = await this.payslipModel.findById(id);
    if (!slip) throw new NotFoundException('Payslip not found');
    const run = await this.runModel.findById(slip.run);
    if (!run || run.status !== 'draft') throw new BadRequestException('Only draft payroll can be edited');
    this.access.assertCanAccess(actor, String(slip.employee), slip.branch);
    for (const k of ['otherEarnings', 'otherDeductions', 'lateDeduction', 'absentDeduction', 'overtimePay', 'bonus']) {
      if (dto[k] !== undefined) (slip as any)[k] = round(dto[k]);
    }
    if (dto.remarks !== undefined) slip.remarks = dto.remarks;
    slip.totalEarnings = round(slip.gross + slip.overtimePay + slip.bonus + slip.otherEarnings);
    slip.totalDeductions = round(slip.lateDeduction + slip.absentDeduction + slip.advanceDeduction + slip.loanDeduction + slip.fixedDeductions + slip.otherDeductions);
    slip.netSalary = Math.round(Math.max(0, slip.totalEarnings - slip.totalDeductions));
    slip.manuallyAdjusted = true;
    await slip.save();
    await this.refreshTotals(run);
    return slip;
  }

  // Locks the run and books loan/advance recoveries.
  async finalize(id: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const run = await this.runModel.findById(id);
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'draft') throw new BadRequestException(`Payroll is already ${run.status}`);
    if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can finalize payroll');
    const slips = await this.payslipModel.find({ run: run._id }).lean();
    for (const s of slips) {
      for (const line of s.lines.filter((l) => l.kind === 'deduction' && l.ref && /^(Advance|Loan) /.test(l.label))) {
        const loan = await this.loanModel.findById(line.ref);
        if (!loan) continue;
        loan.recoveredAmount = round(loan.recoveredAmount + line.amount);
        loan.recoveries.push({ month: run.month, amount: line.amount, run: String(run._id), at: new Date() });
        if (loan.recoveredAmount >= loan.amount) loan.status = 'completed';
        await loan.save();
      }
    }
    run.status = 'finalized';
    run.finalizedBy = { id: actor.id, name: actor.name, at: new Date() };
    await run.save();
    return run;
  }

  async markPaid(id: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const run = await this.runModel.findById(id);
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'finalized') throw new BadRequestException('Finalize the payroll before marking it paid');
    run.status = 'paid';
    run.paidBy = { id: actor.id, name: actor.name, at: new Date() };
    await run.save();
    return run;
  }

  // Super admin only: unlock a finalized run and reverse its recoveries.
  async reopen(id: string, actor: Actor) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Only Super Admin can reopen a finalized payroll');
    const run = await this.runModel.findById(id);
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status === 'draft') return run;
    const loans = await this.loanModel.find({ 'recoveries.run': String(run._id) });
    for (const loan of loans) {
      const mine = loan.recoveries.filter((r) => r.run === String(run._id));
      loan.recoveredAmount = round(loan.recoveredAmount - mine.reduce((s, r) => s + r.amount, 0));
      loan.recoveries = loan.recoveries.filter((r) => r.run !== String(run._id)) as any;
      if (loan.status === 'completed' && loan.recoveredAmount < loan.amount) loan.status = 'active';
      await loan.save();
    }
    run.status = 'draft';
    run.finalizedBy = null;
    run.paidBy = null;
    await run.save();
    return run;
  }

  async removeRun(id: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const run = await this.runModel.findById(id);
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'draft') throw new BadRequestException('Only draft payroll can be deleted');
    await this.payslipModel.deleteMany({ run: run._id });
    await run.deleteOne();
    return { message: 'Draft payroll deleted' };
  }

  // Employee's own finalized payslips.
  async myPayslips(actor: Actor) {
    const runs = await this.runModel.find({ status: { $in: ['finalized', 'paid'] } }).select('_id').lean();
    return this.payslipModel.find({ employee: new Types.ObjectId(actor.id), run: { $in: runs.map((r) => r._id) } }).sort({ month: -1 }).lean();
  }
}
