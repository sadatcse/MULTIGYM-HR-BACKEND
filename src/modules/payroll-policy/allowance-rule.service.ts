import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ALLOWANCE_KINDS, AllowanceRule, AllowanceRuleDocument } from './schemas/allowance-rule.schema';
import { DUTY_TYPES } from '../roster/schemas/roster.schema';
import { Actor } from '../hr-config/hr-access.service';
import { cleanAppliesTo } from '../payroll/payroll-engine';

const DUTIES = DUTY_TYPES.filter((d) => d !== 'off') as string[];
const DAY_TYPES = ['holiday', 'weekend'];

@Injectable()
export class AllowanceRuleService {
  constructor(@InjectModel(AllowanceRule.name) private readonly model: Model<AllowanceRuleDocument>) {}

  private assertManage(actor: Actor) {
    if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can change payroll rules');
  }

  async list(query: any) {
    const filter: any = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.kind && query.kind !== 'all') filter.kind = query.kind;
    const data = await this.model.find(filter).sort({ status: 1, kind: 1, name: 1 }).lean();
    return { data, stats: { total: data.length, active: data.filter((r) => r.status === 'active').length } };
  }

  // Validates and normalizes a create / update body. `current` fills fields
  // the body leaves out on update.
  private clean(dto: any, current: any = {}) {
    const v = { ...current, ...dto };
    const name = String(v.name || '').trim();
    if (!name) throw new BadRequestException('Name is required');
    if (!ALLOWANCE_KINDS.includes(v.kind)) throw new BadRequestException('Choose what the allowance is paid for');
    const amount = Number(v.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Amount must be greater than 0');
    const out: any = {
      name,
      kind: v.kind,
      amount: Math.round(amount * 100) / 100,
      amountType: ['off_day_work', 'roster_duty'].includes(v.kind) && v.amountType === 'day_rate' ? 'day_rate' : 'fixed',
      dutyTypes: [],
      dayTypes: [],
      replacesOvertime: true,
      maxAbsent: 0,
      maxLate: 0,
      appliesTo: cleanAppliesTo(v.appliesTo),
      notes: String(v.notes || '').trim().slice(0, 500),
      status: v.status === 'inactive' ? 'inactive' : 'active',
    };
    if (v.kind === 'roster_duty') {
      out.dutyTypes = [...new Set((Array.isArray(v.dutyTypes) ? v.dutyTypes : []).filter((d: string) => DUTIES.includes(d)))];
      if (!out.dutyTypes.length) throw new BadRequestException('Pick at least one roster duty type');
      if (out.amountType === 'day_rate' && out.amount > 5) throw new BadRequestException('Day-rate multiplier should be between 0.1 and 5 (e.g. 1 = one day’s pay)');
    }
    if (v.kind === 'off_day_work') {
      out.dayTypes = [...new Set((Array.isArray(v.dayTypes) ? v.dayTypes : []).filter((d: string) => DAY_TYPES.includes(d)))];
      if (!out.dayTypes.length) throw new BadRequestException('Pick holidays, weekly offs or both');
      out.replacesOvertime = v.replacesOvertime !== false;
      if (out.amountType === 'day_rate' && out.amount > 5) throw new BadRequestException('Day-rate multiplier should be between 0.1 and 5 (e.g. 1 = one day’s pay)');
    }
    if (v.kind === 'perfect_attendance') {
      out.maxAbsent = Math.max(0, Math.floor(Number(v.maxAbsent) || 0));
      out.maxLate = Math.max(0, Math.floor(Number(v.maxLate) || 0));
    }
    return out;
  }

  async create(dto: any, actor: Actor) {
    this.assertManage(actor);
    return this.model.create({ ...this.clean(dto), updatedBy: { id: actor.id, name: actor.name } });
  }

  async update(id: string, dto: any, actor: Actor) {
    this.assertManage(actor);
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Allowance rule not found');
    Object.assign(doc, this.clean(dto, doc.toObject()), { updatedBy: { id: actor.id, name: actor.name } });
    await doc.save();
    return doc;
  }

  async remove(id: string, actor: Actor) {
    this.assertManage(actor);
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Allowance rule not found');
    return { message: 'Allowance rule deleted' };
  }
}
