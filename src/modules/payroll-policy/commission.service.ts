import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { COMMISSION_TARGETS, CommissionEntry, CommissionEntryDocument, CommissionPlan, CommissionPlanDocument } from './schemas/commission.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { PayrollRun, PayrollRunDocument } from '../payroll/schemas/payroll.schema';
import { Actor, HrAccessService } from '../hr-config/hr-access.service';
import { calcCommission, cleanAppliesTo, coversEmployee } from '../payroll/payroll-engine';
import { isMonthStr, monthRange } from '../../common/helpers/hr-date.helper';

const FIGURES = ['ptSessions', 'ptMonthlyClients', 'ptSalesAmount', 'membershipSalesAmount', 'newMembers', 'productSalesAmount', 'productItems'] as const;
const COUNTS = ['ptSessions', 'ptMonthlyClients', 'newMembers', 'productItems'];
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class CommissionService {
  constructor(
    @InjectModel(CommissionPlan.name) private readonly planModel: Model<CommissionPlanDocument>,
    @InjectModel(CommissionEntry.name) private readonly entryModel: Model<CommissionEntryDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(PayrollRun.name) private readonly runModel: Model<PayrollRunDocument>,
    private readonly access: HrAccessService,
  ) {}

  private async currency() {
    return (await this.access.getConfig()).payroll?.currency || '৳';
  }

  // ======================================================================
  // Plans
  // ======================================================================

  async listPlans(query: any) {
    const filter: any = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    const data = await this.planModel.find(filter).sort({ status: 1, name: 1 }).lean();
    const usage = await this.entryModel.aggregate([{ $group: { _id: '$plan', entries: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$total', 0] } } } }]);
    const byPlan = new Map(usage.map((u) => [String(u._id), u]));
    return { data: data.map((p) => ({ ...p, entries: byPlan.get(String(p._id))?.entries || 0, approvedTotal: r2(byPlan.get(String(p._id))?.paid || 0) })) };
  }

  private cleanPlan(dto: any, current: any = {}) {
    const v = { ...current, ...dto };
    const name = String(v.name || '').trim();
    if (!name) throw new BadRequestException('Plan name is required');
    const money = (k: string) => {
      const n = Number(v[k] ?? 0);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${k} cannot be negative`);
      return r2(n);
    };
    const pct = (k: string) => {
      const n = money(k);
      if (n > 100) throw new BadRequestException('Percentages must be between 0 and 100');
      return n;
    };
    const slabs = (Array.isArray(v.slabs) ? v.slabs : [])
      .map((s: any) => ({ min: r2(s?.min), bonus: r2(s?.bonus) }))
      .filter((s: any) => s.min > 0 && s.bonus > 0)
      .sort((a: any, b: any) => a.min - b.min)
      .slice(0, 10);
    const out = {
      name,
      ptSessionRate: money('ptSessionRate'),
      ptMonthlyRate: money('ptMonthlyRate'),
      productItemRate: money('productItemRate'),
      ptSalesPercent: pct('ptSalesPercent'),
      membershipSalesPercent: pct('membershipSalesPercent'),
      newMemberRate: money('newMemberRate'),
      productSalesPercent: pct('productSalesPercent'),
      targetMetric: COMMISSION_TARGETS.includes(v.targetMetric) ? v.targetMetric : 'total_sales',
      slabs,
      appliesTo: cleanAppliesTo(v.appliesTo),
      notes: String(v.notes || '').trim().slice(0, 500),
      status: v.status === 'inactive' ? 'inactive' : 'active',
    };
    if (!out.ptSessionRate && !out.ptMonthlyRate && !out.productItemRate && !out.ptSalesPercent && !out.membershipSalesPercent && !out.newMemberRate && !out.productSalesPercent && !slabs.length) {
      throw new BadRequestException('Set at least one rate or target slab');
    }
    return out;
  }

  private assertManage(actor: Actor) {
    if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can change commission plans');
  }

  // What a plan (saved or still being edited) pays for sample figures.
  async simulate(dto: any) {
    const plan = { ...(dto?.plan || {}), name: String(dto?.plan?.name || 'Plan') };
    return calcCommission(plan, dto?.figures || {}, await this.currency());
  }

  async createPlan(dto: any, actor: Actor) {
    this.assertManage(actor);
    const clean = this.cleanPlan(dto);
    if (await this.planModel.exists({ name: { $regex: `^${escapeRegex(clean.name)}$`, $options: 'i' } })) throw new BadRequestException(`A plan named "${clean.name}" already exists`);
    return this.planModel.create({ ...clean, updatedBy: { id: actor.id, name: actor.name } });
  }

  async updatePlan(id: string, dto: any, actor: Actor) {
    this.assertManage(actor);
    const plan = await this.planModel.findById(id);
    if (!plan) throw new NotFoundException('Commission plan not found');
    Object.assign(plan, this.cleanPlan(dto, plan.toObject()), { updatedBy: { id: actor.id, name: actor.name } });
    await plan.save();
    // Unapproved figures follow the new rates; approved ones stay as approved.
    const currency = await this.currency();
    const drafts = await this.entryModel.find({ plan: plan._id, status: 'draft' });
    for (const e of drafts) {
      if (await this.lockedFor(e.month, e.branch)) continue;
      const r = calcCommission(plan.toObject() as any, e.toObject() as any, currency);
      e.breakdown = r.lines;
      e.total = r.total;
      e.planName = plan.name;
      e.markModified('breakdown');
      await e.save();
    }
    return plan;
  }

  async removePlan(id: string, actor: Actor) {
    this.assertManage(actor);
    const used = await this.entryModel.countDocuments({ plan: new Types.ObjectId(id) });
    if (used) throw new BadRequestException(`This plan is used by ${used} commission entr${used === 1 ? 'y' : 'ies'} — set it inactive instead`);
    const doc = await this.planModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Commission plan not found');
    return { message: 'Commission plan deleted' };
  }

  // ======================================================================
  // Monthly entries
  // ======================================================================

  private async lockedFor(month: string, branch?: string) {
    const run = await this.runModel.findOne({ month, status: { $ne: 'draft' }, branch: { $in: ['all', branch || ''] } }).select('status branch').lean();
    return run ? run.status : null;
  }

  private async assertOpen(month: string, branch?: string) {
    const locked = await this.lockedFor(month, branch);
    if (locked) throw new BadRequestException(`Payroll for ${month} is already ${locked} — commission can no longer change`);
  }

  // Everyone covered by an active plan (or already holding an entry) in the
  // actor's branches, with their figures for the month.
  async sheet(query: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Commission sheets are restricted to HR/management');
    if (!isMonthStr(query.month)) throw new BadRequestException('month must be YYYY-MM');
    const { from, to } = monthRange(query.month);
    const empFilter: any = { status: { $nin: ['inactive'] } };
    const branches = this.access.resolveBranchFilter(actor, query.branch);
    if (branches) empFilter.branches = { $in: branches };
    const [emps, plans, entries] = await Promise.all([
      this.employeeModel.find(empFilter).select('name employeeId jobPosition branches role employeeType status joiningDate lastWorkingDate photo').sort({ name: 1 }).lean(),
      this.planModel.find({ status: 'active' }).sort({ name: 1 }).lean(),
      this.entryModel.find({ month: query.month }).lean(),
    ]);
    const entryByEmp = new Map(entries.map((e) => [String(e.employee), e]));
    const lockCache = new Map<string, string | null>();
    const rows: any[] = [];
    for (const e of emps) {
      if ((e.joiningDate && e.joiningDate > to) || (e.lastWorkingDate && e.lastWorkingDate < from)) continue;
      const entry = entryByEmp.get(String(e._id)) || null;
      const covering = plans.filter((p) => coversEmployee(p.appliesTo as any, e as any));
      if (!entry && !covering.length) continue;
      const branch = e.branches?.[0] || '';
      if (!lockCache.has(branch)) lockCache.set(branch, await this.lockedFor(query.month, branch));
      rows.push({
        employee: { _id: e._id, name: e.name, employeeId: e.employeeId, jobPosition: e.jobPosition, branch, photo: e.photo },
        entry,
        planIds: covering.map((p) => String(p._id)),
        defaultPlanId: entry ? String(entry.plan) : covering[0] ? String(covering[0]._id) : null,
        locked: lockCache.get(branch),
      });
    }
    const q = String(query.search || '').trim().toLowerCase();
    const shown = q ? rows.filter((r) => `${r.employee.name} ${r.employee.employeeId}`.toLowerCase().includes(q)) : rows;
    const sumBy = (status: string) => r2(shown.filter((r) => r.entry?.status === status).reduce((s, r) => s + (r.entry?.total || 0), 0));
    return {
      month: query.month,
      plans,
      rows: shown,
      stats: { people: shown.length, entered: shown.filter((r) => r.entry).length, approved: shown.filter((r) => r.entry?.status === 'approved').length, approvedTotal: sumBy('approved'), draftTotal: sumBy('draft') },
    };
  }

  async saveEntry(dto: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Commission sheets are restricted to HR/management');
    if (!isMonthStr(dto.month)) throw new BadRequestException('month must be YYYY-MM');
    const emp = await this.employeeModel.findById(dto.employeeId).lean();
    if (!emp) throw new NotFoundException('Employee not found');
    if (String(emp._id) === actor.id && !actor.isSuperAdmin) throw new ForbiddenException('You cannot enter your own commission');
    this.access.assertCanAccess(actor, String(emp._id), emp.branches);
    const branch = emp.branches?.[0] || '';
    await this.assertOpen(dto.month, branch);
    const plan = await this.planModel.findById(dto.planId).lean();
    if (!plan) throw new BadRequestException('Choose a commission plan');
    const figures: any = {};
    for (const k of FIGURES) {
      const n = Number(dto[k] ?? 0);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Figures cannot be negative');
      figures[k] = COUNTS.includes(k) ? Math.floor(n) : r2(n);
    }
    const r = calcCommission(plan as any, figures, await this.currency());
    // Any change sends an approved entry back for approval.
    return this.entryModel.findOneAndUpdate(
      { employee: emp._id, month: dto.month },
      {
        $set: {
          employeeName: emp.name,
          employeeCode: emp.employeeId || '',
          designation: emp.jobPosition || '',
          branch,
          plan: plan._id,
          planName: plan.name,
          ...figures,
          breakdown: r.lines,
          total: r.total,
          status: 'draft',
          approvedBy: null,
          note: String(dto.note || '').trim().slice(0, 300),
          updatedBy: { id: actor.id, name: actor.name, at: new Date() },
        },
      },
      { upsert: true, new: true },
    );
  }

  async setStatus(dto: any, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Not allowed');
    const status = dto.status === 'approved' ? 'approved' : 'draft';
    const ids = (Array.isArray(dto.ids) ? dto.ids : []).filter((id: string) => Types.ObjectId.isValid(id));
    if (!ids.length) throw new BadRequestException('Nothing selected');
    const entries = await this.entryModel.find({ _id: { $in: ids } });
    let changed = 0;
    for (const e of entries) {
      if (String(e.employee) === actor.id && !actor.isSuperAdmin) throw new ForbiddenException('You cannot approve your own commission');
      this.access.assertCanAccess(actor, String(e.employee), e.branch);
      await this.assertOpen(e.month, e.branch);
      if (e.status === status) continue;
      e.status = status;
      e.approvedBy = status === 'approved' ? { id: actor.id, name: actor.name, at: new Date() } : null;
      await e.save();
      changed++;
    }
    return { changed, message: status === 'approved' ? `${changed} approved for payroll` : `${changed} moved back to draft` };
  }

  async removeEntry(id: string, actor: Actor) {
    if (actor.scope === 'self') throw new ForbiddenException('Not allowed');
    const e = await this.entryModel.findById(id);
    if (!e) throw new NotFoundException('Commission entry not found');
    this.access.assertCanAccess(actor, String(e.employee), e.branch);
    await this.assertOpen(e.month, e.branch);
    await e.deleteOne();
    return { message: 'Commission entry removed' };
  }
}
