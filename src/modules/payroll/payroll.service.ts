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
import { AdvancePolicy, AdvancePolicyDocument } from '../advance-policy/schemas/advance-policy.schema';
import { BonusPolicy, BonusPolicyDocument } from '../bonus-policy/schemas/bonus-policy.schema';
import { ProxyDuty, ProxyDutyDocument } from '../proxy-duty/schemas/proxy-duty.schema';
import { RosterAssignment, RosterAssignmentDocument } from '../roster/schemas/roster.schema';
import { AllowanceRule, AllowanceRuleDocument } from '../payroll-policy/schemas/allowance-rule.schema';
import { CommissionEntry, CommissionEntryDocument, CommissionPlan, CommissionPlanDocument } from '../payroll-policy/schemas/commission.schema';
import { OvertimeRecord, OvertimeRecordDocument } from '../overtime/schemas/overtime-record.schema';
import { calcBonus, checkAdvance, computePayslip, coversEmployee, summarizeDays } from './payroll-engine';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { AttendanceService } from '../attendance/attendance.service';
import { EmployeeHistoryService } from '../employee-history/employee-history.service';
import { isDateStr, isMonthStr, monthRange, todayStr } from '../../common/helpers/hr-date.helper';
import { createWithRefNo } from '../../common/helpers/ref-no.helper';

const INACTIVE = ['inactive'];
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (list: Array<{ amount: number }> = []) => list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
// The full salary breakdown kept on every revision, so old salaries can be shown in detail.
const salarySnapshot = (d: any) =>
  d
    ? {
        basic: d.basic || 0,
        houseRent: d.houseRent || 0,
        medical: d.medical || 0,
        conveyance: d.conveyance || 0,
        otherAllowances: (d.otherAllowances || []).map((x: any) => ({ name: x.name, amount: x.amount })),
        fixedDeductions: (d.fixedDeductions || []).map((x: any) => ({ name: x.name, amount: x.amount })),
        gross: d.gross || 0,
        paymentMode: d.paymentMode || 'cash',
      }
    : null;
const breakdownKey = (d: any) => JSON.stringify([d.houseRent || 0, d.medical || 0, d.conveyance || 0, (d.otherAllowances || []).map((x: any) => [x.name, x.amount]), (d.fixedDeductions || []).map((x: any) => [x.name, x.amount])]);

const cleanList = (list: any) =>
  (Array.isArray(list) ? list : [])
    .filter((x) => x && String(x.name || '').trim() && Number(x.amount) >= 0)
    .map((x) => ({ name: String(x.name).trim(), amount: round(x.amount) }));

type MonthContext = Awaited<ReturnType<PayrollService['monthContext']>>;

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
    @InjectModel(AdvancePolicy.name) private readonly advancePolicyModel: Model<AdvancePolicyDocument>,
    @InjectModel(BonusPolicy.name) private readonly bonusPolicyModel: Model<BonusPolicyDocument>,
    @InjectModel(ProxyDuty.name) private readonly proxyModel: Model<ProxyDutyDocument>,
    @InjectModel(RosterAssignment.name) private readonly rosterModel: Model<RosterAssignmentDocument>,
    @InjectModel(AllowanceRule.name) private readonly allowanceModel: Model<AllowanceRuleDocument>,
    @InjectModel(CommissionPlan.name) private readonly commissionPlanModel: Model<CommissionPlanDocument>,
    @InjectModel(CommissionEntry.name) private readonly commissionEntryModel: Model<CommissionEntryDocument>,
    @InjectModel(OvertimeRecord.name) private readonly overtimeRecordModel: Model<OvertimeRecordDocument>,
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

  // Salary record of one employee: every structure change (newest first) and
  // the salary of every payroll month they were in.
  async structureHistory(employeeId: string, actor: Actor) {
    if (!Types.ObjectId.isValid(employeeId)) throw new BadRequestException('Invalid employee');
    const emp = await this.employeeModel.findById(employeeId).select('name employeeId jobPosition department branches joiningDate photo status basicSalary grossSalary').lean();
    if (!emp) throw new NotFoundException('Employee not found');
    if (employeeId !== actor.id) {
      this.assertPayrollAccess(actor);
      this.access.assertCanAccess(actor, employeeId, emp.branches);
    }
    const [structure, payslips] = await Promise.all([
      this.structureModel.findOne({ employee: emp._id }).lean(),
      this.payslipModel
        .find({ employee: emp._id })
        .select('run month branch designation paymentMode basic houseRent medical conveyance otherAllowances gross totalEarnings totalDeductions netSalary')
        .sort({ month: -1 })
        .lean(),
    ]);
    const runs = await this.runModel.find({ _id: { $in: payslips.map((p) => p.run) } }).select('status').lean();
    const statusOf = new Map(runs.map((r) => [String(r._id), r.status]));
    const revisions = [...(structure?.revisions || [])].sort((a: any, b: any) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)) || new Date(b.at).getTime() - new Date(a.at).getTime());
    return {
      employee: emp,
      structure: structure ? { ...structure, revisions: undefined } : null,
      revisions,
      payslips: payslips.map((p) => ({ ...p, runStatus: statusOf.get(String(p.run)) || '' })),
    };
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
    const previous = salarySnapshot(doc);
    const effectiveFrom = dto.effectiveFrom || todayStr();
    // Moving money between allowances with the same total is still a revision.
    const changed = !doc || previousGross !== gross || previousBasic !== values.basic || breakdownKey(doc) !== breakdownKey(values);
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
      doc.revisions.push({
        type,
        effectiveFrom,
        previousBasic,
        newBasic: values.basic,
        previousGross,
        newGross: gross,
        previous,
        snapshot: salarySnapshot(doc),
        remarks: dto.remarks || '',
        by: { id: actor.id, name: actor.name },
        at: new Date(),
      } as any);
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
    const type = ['advance', 'loan', 'adjustment'].includes(dto.type) ? dto.type : 'advance';

    // Advances follow the active advance policy; HR may grant one outside it
    // with a recorded reason.
    let policyOverride: any = null;
    if (type === 'advance') {
      const check = await this.advanceCheck(emp, amount, installment);
      if (!check.eligible) {
        const failed = check.checks.filter((c) => !c.ok).map((c) => c.label);
        if (!dto.override) throw new BadRequestException(`Outside the "${check.policy?.policyName}" advance policy: ${failed.join('; ')}`);
        if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can grant an advance outside the policy');
        const reason = String(dto.overrideReason || '').trim();
        if (!reason) throw new BadRequestException('Give a reason for granting this advance outside the policy');
        policyOverride = { policy: check.policy?.policyName || '', failed, reason, by: { id: actor.id, name: actor.name }, at: new Date() };
      }
    }

    const prefix = type === 'loan' ? 'LN' : type === 'adjustment' ? 'ADJ' : 'ADV';
    return createWithRefNo(this.loanModel, 'loanNo', prefix, {
      employee: emp._id,
      employeeName: emp.name,
      employeeCode: emp.employeeId || '',
      branch: emp.branches?.[0] || '',
      type,
      policyOverride,
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

    const { from, to } = monthRange(dto.month);
    const empFilter: any = { status: { $nin: INACTIVE } };
    if (branch !== 'all') empFilter['branches.0'] = branch;
    const emps = (await this.employeeModel.find(empFilter).lean()).filter((e) => this.inPayrollMonth(e, from, to));
    const ctx = await this.monthContext(dto.month, emps);

    // Keep manual edits of a draft across regenerations? No — regenerate is
    // an explicit "recalculate everything"; drop the old draft payslips.
    await this.payslipModel.deleteMany({ run: run._id });

    const skipped: string[] = [];
    const slips: any[] = [];
    for (const emp of emps) {
      const r = this.computeFor(emp, ctx);
      if (r.skipped) {
        skipped.push(r.skipped);
        continue;
      }
      // The explanation and rates are for the simulator; the payslip keeps lines.
      const { skipped: _skipped, explain: _explain, perDay: _perDay, hourly: _hourly, ...fields } = r as any;
      slips.push({
        run: run._id,
        month: dto.month,
        employee: emp._id,
        employeeName: emp.name,
        employeeCode: emp.employeeId || '',
        designation: emp.jobPosition || '',
        department: emp.department || '',
        branch: emp.branches?.[0] || '',
        ...fields,
      });
    }
    if (slips.length) await this.payslipModel.insertMany(slips);
    await this.refreshTotals(run);
    return { run, generated: slips.length, skipped };
  }

  // Joined by the month's end, not gone before it starts; separated staff
  // are only paid up to a recorded last working day.
  private inPayrollMonth(e: any, from: string, to: string) {
    return (!e.joiningDate || e.joiningDate <= to) && (!e.lastWorkingDate || e.lastWorkingDate >= from) && !(['resigned', 'terminated'].includes(e.status) && !e.lastWorkingDate);
  }

  // When several policies of a kind are active, the most recently updated one is used.
  private activeLatePolicy() {
    return this.latePolicyModel.findOne({ status: 'active' }).sort({ updatedAt: -1 }).lean();
  }

  private activeOvertimePolicy() {
    return this.overtimePolicyModel.findOne({ status: 'active' }).sort({ updatedAt: -1 }).lean();
  }

  private activeAdvancePolicy() {
    return this.advancePolicyModel.findOne({ status: 'active' }).sort({ updatedAt: -1 }).lean();
  }

  // Everything the salary rules need for these employees in this month,
  // loaded in one pass and grouped per employee.
  async monthContext(month: string, emps: any[]) {
    const { from, to, days: calendarDays } = monthRange(month);
    const cfg = await this.access.getConfig();
    const daysInMonth = cfg.payroll.daysBasis === 'fixed30' ? 30 : calendarDays;
    const ids = emps.map((e) => e._id);
    const codes = emps.map((e) => e.employeeId).filter(Boolean);
    const [structures, records, latePolicy, overtimePolicy, unpaidTypes, adjustments, loans, rules, commissions, proxies] = await Promise.all([
      this.structureModel.find({ employee: { $in: ids } }).lean(),
      this.recordModel
        .find({ date: { $gte: from, $lte: to }, employee: { $in: ids } })
        .select('employee date status isLate lateMinutes isEarlyLeave earlyLeaveMinutes overtimeMinutes leaveTypeName offDay remarks')
        .lean(),
      this.activeLatePolicy(),
      this.activeOvertimePolicy(),
      this.leaveTypeModel.find({ isPaid: 'no' }).select('name').lean(),
      this.adjustmentModel.find({ month, employee: { $in: ids } }).lean(),
      this.loanModel.find({ status: 'active', startMonth: { $lte: month }, employee: { $in: ids } }).lean(),
      this.allowanceModel.find({ status: 'active' }).lean(),
      this.commissionEntryModel.find({ month, status: 'approved', employee: { $in: ids } }).lean(),
      codes.length
        ? this.proxyModel.find({ dutyDate: { $gte: from, $lte: to }, status: { $in: ['active', 'completed'] }, proxyEmployeeId: { $in: codes }, proxyPayAmount: { $gt: 0 }, type: { $ne: 'swap' } }).lean()
        : Promise.resolve([] as any[]),
    ]);
    const otRecords = await this.overtimeRecordModel
      .find({ status: 'approved', recordDate: { $gte: from, $lte: to }, $or: [{ employee: { $in: ids } }, { employee: null, employeeId: { $in: codes } }] })
      .select('employee employeeId overtimeHours overtimeMinutes')
      .lean();
    const idByCode = new Map(emps.map((e) => [String(e.employeeId || ''), String(e._id)]));
    const manualOt = new Map<string, number>();
    for (const r of otRecords as any[]) {
      const k = r.employee ? String(r.employee) : idByCode.get(String(r.employeeId)) || '';
      if (k) manualOt.set(k, (manualOt.get(k) || 0) + Math.round((Number(r.overtimeHours) || 0) * 60 + (Number(r.overtimeMinutes) || 0)));
    }
    const dutyTypes = [...new Set(rules.filter((r) => r.kind === 'roster_duty').flatMap((r) => r.dutyTypes || []))];
    const duties = dutyTypes.length
      ? await this.rosterModel.find({ date: { $gte: from, $lte: to }, employee: { $in: ids }, dutyType: { $in: dutyTypes } }).select('employee date dutyType').lean()
      : [];
    const group = <T>(list: T[], key: (x: T) => string) => {
      const m = new Map<string, T[]>();
      for (const x of list) {
        const k = key(x);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(x);
      }
      return m;
    };
    return {
      month,
      from,
      to,
      calendarDays,
      daysInMonth,
      cfg,
      latePolicy,
      overtimePolicy,
      rules,
      unpaidNames: unpaidTypes.map((t) => t.name),
      structures: new Map(structures.map((s) => [String(s.employee), s])),
      days: group(records as any[], (r) => String(r.employee)),
      adjustments: group(adjustments as any[], (a) => String(a.employee)),
      loans: group(loans as any[], (l) => String(l.employee)),
      commissions: new Map(commissions.map((c) => [String(c.employee), c])),
      proxies: group(proxies as any[], (p) => String(p.proxyEmployeeId)),
      duties: group(duties as any[], (d) => String(d.employee)),
      manualOt,
    };
  }

  private computeFor(emp: any, ctx: MonthContext) {
    const id = String(emp._id);
    return computePayslip({
      month: ctx.month,
      from: ctx.from,
      to: ctx.to,
      calendarDays: ctx.calendarDays,
      daysInMonth: ctx.daysInMonth,
      currency: ctx.cfg.payroll.currency || '৳',
      payroll: ctx.cfg.payroll,
      emp,
      structure: (ctx.structures.get(id) as any) || null,
      days: ctx.days.get(id) || [],
      unpaidLeaveTypes: ctx.unpaidNames,
      latePolicy: ctx.latePolicy,
      overtimePolicy: ctx.overtimePolicy,
      allowanceRules: ctx.rules as any[],
      rosterDuties: ctx.duties.get(id) || [],
      commission: (ctx.commissions.get(id) as any) || null,
      proxyDuties: emp.employeeId ? ctx.proxies.get(String(emp.employeeId)) || [] : [],
      adjustments: ctx.adjustments.get(id) || [],
      loans: ctx.loans.get(id) || [],
      manualOvertimeMinutes: ctx.manualOt.get(id) || 0,
    });
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
          allowancePay: { $sum: '$allowancePay' },
          commission: { $sum: '$commission' },
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
    for (const k of ['otherEarnings', 'otherDeductions', 'lateDeduction', 'absentDeduction', 'overtimePay', 'allowancePay', 'commission', 'bonus']) {
      if (dto[k] !== undefined) (slip as any)[k] = round(dto[k]);
    }
    if (dto.remarks !== undefined) slip.remarks = dto.remarks;
    slip.totalEarnings = round(slip.gross + slip.overtimePay + (slip.allowancePay || 0) + (slip.commission || 0) + slip.bonus + slip.otherEarnings);
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
      for (const line of s.lines.filter((l) => l.kind === 'deduction' && l.ref && (l.group ? l.group === 'loan' : /^(Advance|Loan) /.test(l.label)))) {
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

  // ======================================================================
  // Salary simulator & policy overview
  // ======================================================================

  // One employee's payslip for a month, worked out with today's data and
  // policies, with the reason behind every figure. Nothing is saved.
  async preview(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    if (!isMonthStr(query.month)) throw new BadRequestException('month must be YYYY-MM');
    if (!Types.ObjectId.isValid(query.employeeId)) throw new BadRequestException('Choose an employee');
    const emp: any = await this.employeeModel.findById(query.employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    const { from, to } = monthRange(query.month);
    const ctx = await this.monthContext(query.month, [emp]);
    const result = this.computeFor(emp, ctx);
    const existing = await this.payslipModel.findOne({ month: query.month, employee: emp._id }).select('netSalary run updatedAt manuallyAdjusted').lean();
    const run = existing ? await this.runModel.findById(existing.run).select('status branch').lean() : null;
    return {
      employee: { _id: emp._id, name: emp.name, employeeId: emp.employeeId, jobPosition: emp.jobPosition, branch: emp.branches?.[0] || '', joiningDate: emp.joiningDate, status: emp.status, photo: emp.photo },
      month: query.month,
      inMonth: this.inPayrollMonth(emp, from, to),
      result,
      policies: {
        late: ctx.latePolicy ? ctx.latePolicy.policyName : null,
        overtime: ctx.overtimePolicy ? ctx.overtimePolicy.policyName : null,
        allowanceRules: (ctx.rules as any[]).filter((r) => coversEmployee(r.appliesTo, emp)).map((r) => r.name),
      },
      sheet: existing ? { netSalary: existing.netSalary, status: run?.status || null, branch: run?.branch || null, manuallyAdjusted: existing.manuallyAdjusted, updatedAt: (existing as any).updatedAt } : null,
    };
  }

  // Which policy of each kind payroll will use, and what is switched on.
  async policySummary(actor: Actor) {
    this.assertPayrollAccess(actor);
    const cfg = await this.access.getConfig();
    const active = { status: 'active' };
    const [late, overtime, advance, bonus, rules, plans, staff, structures] = await Promise.all([
      this.latePolicyModel.find(active).sort({ updatedAt: -1 }).lean(),
      this.overtimePolicyModel.find(active).sort({ updatedAt: -1 }).lean(),
      this.advancePolicyModel.find(active).sort({ updatedAt: -1 }).lean(),
      this.bonusPolicyModel.find(active).sort({ policyName: 1 }).lean(),
      this.allowanceModel.find(active).sort({ kind: 1, name: 1 }).lean(),
      this.commissionPlanModel.find(active).sort({ name: 1 }).lean(),
      this.employeeModel.countDocuments({ status: { $nin: ['inactive', 'resigned', 'terminated'] } }),
      this.structureModel.countDocuments(),
    ]);
    const pick = (list: any[]) => ({ used: list[0] || null, activeCount: list.length, others: list.slice(1).map((p) => p.policyName) });
    return {
      payroll: cfg.payroll,
      attendance: cfg.attendance,
      late: pick(late),
      overtime: pick(overtime),
      advance: pick(advance),
      bonus,
      allowanceRules: rules,
      commissionPlans: plans,
      coverage: { staff, structures },
    };
  }

  // ======================================================================
  // Bonus runs (bonus policy → payroll adjustments)
  // ======================================================================

  private async bonusRows(dto: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    if (!isMonthStr(dto.month)) throw new BadRequestException('month must be YYYY-MM');
    if (!Types.ObjectId.isValid(dto.policyId)) throw new BadRequestException('Choose a bonus policy');
    const policy: any = await this.bonusPolicyModel.findById(dto.policyId).lean();
    if (!policy) throw new NotFoundException('Bonus policy not found');
    const branch = dto.branch && dto.branch !== 'all' ? dto.branch : 'all';
    if (actor.scope === 'branch' && (branch === 'all' || !actor.branches.includes(branch))) throw new ForbiddenException('You can only run a bonus for your own branch');

    const { from, to } = monthRange(dto.month);
    const cfg = await this.access.getConfig();
    const empFilter: any = { status: { $nin: INACTIVE } };
    if (branch !== 'all') empFilter['branches.0'] = branch;
    const emps = (await this.employeeModel.find(empFilter).sort({ name: 1 }).lean()).filter((e) => this.inPayrollMonth(e, from, to));
    const ids = emps.map((e) => e._id);
    const needsAttendance = Number(policy.maxAbsentDays ?? -1) >= 0 || Number(policy.maxLateDays ?? -1) >= 0;
    const [structures, posted, records, unpaidTypes] = await Promise.all([
      this.structureModel.find({ employee: { $in: ids } }).select('employee basic gross').lean(),
      this.adjustmentModel.find({ 'source.id': String(policy._id), month: dto.month, employee: { $in: ids } }).lean(),
      needsAttendance ? this.recordModel.find({ date: { $gte: from, $lte: to }, employee: { $in: ids } }).select('employee date status isLate leaveTypeName').lean() : Promise.resolve([] as any[]),
      needsAttendance ? this.leaveTypeModel.find({ isPaid: 'no' }).select('name').lean() : Promise.resolve([] as any[]),
    ]);
    const structMap = new Map(structures.map((s) => [String(s.employee), s]));
    const postedMap = new Map(posted.map((p) => [String(p.employee), p]));
    const daysByEmp = new Map<string, any[]>();
    for (const r of records as any[]) {
      const k = String(r.employee);
      if (!daysByEmp.has(k)) daysByEmp.set(k, []);
      daysByEmp.get(k)!.push(r);
    }
    const unpaidNames = (unpaidTypes as any[]).map((t) => t.name);

    let notCovered = 0;
    const rows: any[] = [];
    for (const e of emps) {
      const id = String(e._id);
      const st = structMap.get(id);
      const basic = st?.basic || e.basicSalary || 0;
      const gross = st?.gross || e.grossSalary || basic;
      const att = needsAttendance ? summarizeDays(daysByEmp.get(id) || [], unpaidNames) : null;
      const r = calcBonus(policy, e as any, { basic, gross, onDate: to, absent: att ? att.absent + att.unpaidLeave : 0, late: att?.late || 0, currency: cfg.payroll.currency || '৳' });
      if (!r.covered) {
        notCovered++;
        continue;
      }
      const p = postedMap.get(id);
      rows.push({
        employee: { _id: e._id, name: e.name, employeeId: e.employeeId, jobPosition: e.jobPosition, branch: e.branches?.[0] || '', status: e.status, joiningDate: e.joiningDate },
        basic,
        gross,
        ...r,
        absent: att ? att.absent + att.unpaidLeave : null,
        late: att ? att.late : null,
        posted: p ? { _id: p._id, amount: p.amount } : null,
      });
    }
    const branchesTouched = [...new Set(rows.map((r) => r.employee.branch))];
    const locks: string[] = [];
    for (const b of branchesTouched) {
      const run = await this.runModel.findOne({ month: dto.month, status: { $ne: 'draft' }, branch: { $in: ['all', b] } }).select('status branch').lean();
      if (run) locks.push(`${run.branch === 'all' ? 'Combined' : run.branch} payroll is ${run.status}`);
    }
    const eligible = rows.filter((r) => r.eligible);
    return {
      policy,
      month: dto.month,
      branch,
      rows,
      locks,
      stats: {
        covered: rows.length,
        eligible: eligible.length,
        notEligible: rows.length - eligible.length,
        notCovered,
        total: eligible.reduce((s, r) => s + r.amount, 0),
        postedCount: rows.filter((r) => r.posted).length,
        postedTotal: rows.reduce((s, r) => s + (r.posted?.amount || 0), 0),
      },
    };
  }

  async bonusPreview(dto: any, actor: Actor) {
    return this.bonusRows(dto, actor);
  }

  // Posts the eligible amounts as "bonus" adjustments of the month. Running
  // again replaces this policy's earlier figures for the same people.
  async bonusPost(dto: any, actor: Actor) {
    const data = await this.bonusRows(dto, actor);
    if (data.locks.length) throw new BadRequestException(`Cannot post: ${data.locks.join(', ')}`);
    const pick = Array.isArray(dto.employeeIds) && dto.employeeIds.length ? new Set(dto.employeeIds.map(String)) : null;
    const rows = data.rows.filter((r) => !pick || pick.has(String(r.employee._id)));
    if (!rows.length) throw new BadRequestException('Nobody selected');
    const policyId = String(data.policy._id);
    const removed = await this.adjustmentModel.deleteMany({ 'source.id': policyId, month: data.month, employee: { $in: rows.map((r) => r.employee._id) } });
    const docs = rows
      .filter((r) => r.eligible && r.amount > 0)
      .map((r) => ({
        employee: r.employee._id,
        employeeName: r.employee.name,
        employeeCode: r.employee.employeeId || '',
        branch: r.employee.branch,
        month: data.month,
        type: 'bonus',
        title: data.policy.policyName,
        amount: r.amount,
        note: r.basis,
        createdBy: { id: actor.id, name: actor.name },
        source: { kind: 'bonus_policy', id: policyId, label: data.policy.policyName },
      }));
    if (docs.length) await this.adjustmentModel.insertMany(docs);
    const total = docs.reduce((s, d) => s + d.amount, 0);
    return { posted: docs.length, total, replaced: removed.deletedCount || 0 };
  }

  async bonusUnpost(dto: any, actor: Actor) {
    const data = await this.bonusRows(dto, actor);
    if (data.locks.length) throw new BadRequestException(`Cannot remove: ${data.locks.join(', ')}`);
    const res = await this.adjustmentModel.deleteMany({ 'source.id': String(data.policy._id), month: data.month, employee: { $in: data.rows.map((r) => r.employee._id) } });
    return { removed: res.deletedCount || 0 };
  }

  // Months this policy was posted in, with head count and total.
  async bonusHistory(policyId: string, actor: Actor) {
    this.assertPayrollAccess(actor);
    const match: any = { 'source.id': String(policyId) };
    if (actor.scope === 'branch') match.branch = { $in: actor.branches };
    const rows = await this.adjustmentModel.aggregate([
      { $match: match },
      { $group: { _id: '$month', people: { $sum: 1 }, total: { $sum: '$amount' }, lastAt: { $max: '$createdAt' }, by: { $last: '$createdBy.name' } } },
      { $sort: { _id: -1 } },
    ]);
    return rows.map((r) => ({ month: r._id, people: r.people, total: round(r.total), lastAt: r.lastAt, by: r.by }));
  }

  // ======================================================================
  // Salary advance policy
  // ======================================================================

  private async advanceCheck(emp: any, amount: number, installment: number) {
    const policy: any = await this.activeAdvancePolicy();
    if (!policy) return { policy: null, eligible: true, checks: [] as Array<{ key: string; label: string; ok: boolean; detail: string }>, maxAmount: null, maxInstallments: null, service: null, basic: null };
    const cfg = await this.access.getConfig();
    const st = await this.structureModel.findOne({ employee: emp._id }).select('basic').lean();
    const basic = st?.basic || emp.basicSalary || 0;
    const today = todayStr(cfg.attendance.timezoneOffsetMinutes);
    const year = today.slice(0, 4);
    const [activeAdvances, advancesThisYear] = await Promise.all([
      this.loanModel.countDocuments({ employee: emp._id, type: 'advance', status: 'active' }),
      this.loanModel.countDocuments({ employee: emp._id, type: 'advance', status: { $ne: 'cancelled' }, disbursedOn: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }),
    ]);
    const r = checkAdvance(policy, {
      basic,
      joiningDate: emp.joiningDate,
      status: emp.status,
      today,
      amount,
      installmentAmount: installment || amount,
      activeAdvances,
      advancesThisYear,
      currency: cfg.payroll.currency || '৳',
    });
    return { policy: { _id: policy._id, policyName: policy.policyName }, basic, ...r };
  }

  async advanceEligibility(query: any, actor: Actor) {
    this.assertPayrollAccess(actor);
    if (!Types.ObjectId.isValid(query.employeeId)) throw new BadRequestException('Choose an employee');
    const emp: any = await this.employeeModel.findById(query.employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    return this.advanceCheck(emp, round(query.amount), round(query.installmentAmount));
  }

  // Employee's own finalized payslips.
  async myPayslips(actor: Actor) {
    const runs = await this.runModel.find({ status: { $in: ['finalized', 'paid'] } }).select('_id').lean();
    return this.payslipModel.find({ employee: new Types.ObjectId(actor.id), run: { $in: runs.map((r) => r._id) } }).sort({ month: -1 }).lean();
  }
}
