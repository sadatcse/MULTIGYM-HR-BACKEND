import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { DEFAULT_HR_CONFIG, HrConfig, HrConfigDocument } from './schemas/hr-config.schema';

export type AccessScope = 'all' | 'branch' | 'self';

export interface Actor {
  id: string;
  name: string;
  role: string;
  employeeCode?: string;
  branches: string[];
  scope: AccessScope;
  isSuperAdmin: boolean;
}

const SUPER_ADMIN = ['SUPERADMIN'];

export const normalizeRole = (role?: string) => (role || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

@Injectable()
export class HrAccessService {
  private cache: { value: any; at: number } | null = null;
  // Short-lived actor cache: every HR request resolves its caller, and a
  // page load fires several requests in parallel.
  private actors = new Map<string, { actor: Actor; at: number }>();

  constructor(
    @InjectModel(HrConfig.name) private readonly configModel: Model<HrConfigDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  // Stored config merged over defaults, so a key added in a later release
  // is never undefined for an older stored document.
  async getConfig(): Promise<typeof DEFAULT_HR_CONFIG & { deviceApiKey: string }> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    let doc = await this.configModel.findOne({ key: 'default' }).lean();
    if (!doc) {
      doc = (await this.configModel.create({ ...DEFAULT_HR_CONFIG, deviceApiKey: randomBytes(18).toString('hex') })).toObject();
    }
    const merged = {
      ...DEFAULT_HR_CONFIG,
      ...doc,
      leaveStages: { ...DEFAULT_HR_CONFIG.leaveStages, ...(doc.leaveStages || {}) },
      requisitionStages: { ...DEFAULT_HR_CONFIG.requisitionStages, ...(doc.requisitionStages || {}) },
      attendance: { ...DEFAULT_HR_CONFIG.attendance, ...(doc.attendance || {}) },
      payroll: { ...DEFAULT_HR_CONFIG.payroll, ...(doc.payroll || {}) },
      deviceApiKey: doc.deviceApiKey || '',
    };
    this.cache = { value: merged, at: Date.now() };
    return merged;
  }

  async updateConfig(patch: Partial<HrConfig>, actor: Actor) {
    if (!actor.isSuperAdmin && actor.scope !== 'all') {
      throw new ForbiddenException('Only management can change HR workflow settings');
    }
    // Coerce every field to its expected shape so a malformed request can
    // never store operators, nested objects or non-string role names.
    const p: any = patch || {};
    const roles = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 50) : undefined);
    const stages = (v: any, keys: string[]) => (v && typeof v === 'object' ? Object.fromEntries(keys.map((k) => [k, roles(v[k]) || []])) : undefined);
    const nums = (v: any, keys: string[], strings: string[] = []) => {
      if (!v || typeof v !== 'object') return undefined;
      const out: Record<string, any> = {};
      for (const k of keys) if (v[k] !== undefined && v[k] !== '' && Number.isFinite(Number(v[k]))) out[k] = Number(v[k]);
      for (const k of strings) if (typeof v[k] === 'string') out[k] = v[k].slice(0, 20);
      return out;
    };
    const $set: Record<string, any> = {};
    const cur = await this.getConfig();
    if (roles(p.branchScopedRoles)) $set.branchScopedRoles = roles(p.branchScopedRoles);
    if (roles(p.selfOnlyRoles)) $set.selfOnlyRoles = roles(p.selfOnlyRoles);
    if (stages(p.leaveStages, ['branch', 'hr', 'director'])) $set.leaveStages = stages(p.leaveStages, ['branch', 'hr', 'director']);
    if (typeof p.leaveSkipBranchStage === 'boolean') $set.leaveSkipBranchStage = p.leaveSkipBranchStage;
    if (stages(p.requisitionStages, ['admin', 'management', 'purchase'])) $set.requisitionStages = stages(p.requisitionStages, ['admin', 'management', 'purchase']);
    const att = nums(p.attendance, ['graceMinutes', 'earlyLeaveToleranceMinutes', 'halfDayMinutes', 'overtimeAfterMinutes', 'minPunchGapMinutes', 'timezoneOffsetMinutes'], ['defaultInTime', 'defaultOutTime']);
    if (att) $set.attendance = { ...cur.attendance, ...att };
    const pay = nums(p.payroll, ['standardHoursPerDay'], ['perDayBasis', 'daysBasis', 'currency']);
    if (pay) {
      if (pay.perDayBasis && !['gross', 'basic'].includes(pay.perDayBasis)) delete pay.perDayBasis;
      if (pay.daysBasis && !['calendar', 'fixed30'].includes(pay.daysBasis)) delete pay.daysBasis;
      $set.payroll = { ...cur.payroll, ...pay };
    }
    await this.configModel.updateOne({ key: 'default' }, { $set });
    this.cache = null;
    this.actors.clear();
    return this.getConfig();
  }

  async rotateDeviceKey() {
    await this.getConfig();
    const deviceApiKey = randomBytes(18).toString('hex');
    await this.configModel.updateOne({ key: 'default' }, { $set: { deviceApiKey } });
    this.cache = null;
    return { deviceApiKey };
  }

  // Data scope implied by a role name alone (used by guards that only have
  // the JWT role, not the full employee record).
  async scopeForRole(role?: string): Promise<AccessScope> {
    if (this.isSuperAdmin(role)) return 'all';
    const cfg = await this.getConfig();
    if (this.roleIn(role || '', cfg.selfOnlyRoles)) return 'self';
    if (this.roleIn(role || '', cfg.branchScopedRoles)) return 'branch';
    return 'all';
  }

  roleIn(role: string, list: string[] = []): boolean {
    const r = normalizeRole(role);
    if (!r) return false;
    return list.some((x) => normalizeRole(x) === r);
  }

  isSuperAdmin(role?: string) {
    return SUPER_ADMIN.includes(normalizeRole(role));
  }

  // Resolves the JWT user ({ id, role }) into a full actor with data scope.
  async getActor(user: any): Promise<Actor> {
    const id = user?.id || user?._id;
    if (!id) throw new ForbiddenException('Not authenticated');
    const hit = this.actors.get(String(id));
    if (hit && Date.now() - hit.at < 15_000) return hit.actor;
    const emp = await this.employeeModel.findById(id).select('name role employeeId branches').lean();
    if (!emp) throw new NotFoundException('Your employee account was not found');
    const role = emp.role || user.role || '';
    const cfg = await this.getConfig();
    const superAdmin = this.isSuperAdmin(role);
    let scope: AccessScope = 'all';
    if (!superAdmin) {
      if (this.roleIn(role, cfg.selfOnlyRoles)) scope = 'self';
      else if (this.roleIn(role, cfg.branchScopedRoles)) scope = 'branch';
    }
    const actor: Actor = {
      id: String(emp._id),
      name: emp.name,
      role,
      employeeCode: emp.employeeId,
      branches: emp.branches || [],
      scope,
      isSuperAdmin: superAdmin,
    };
    if (this.actors.size > 500) this.actors.clear();
    this.actors.set(String(id), { actor, at: Date.now() });
    return actor;
  }

  // Mongo filter fragment restricting a query to what the actor may see.
  // `employeeField` / `branchField` name the fields on the target collection.
  scopeFilter(actor: Actor, employeeField = 'employee', branchField = 'branch'): Record<string, any> {
    if (actor.scope === 'self') return { [employeeField]: actor.id };
    if (actor.scope === 'branch') return { [branchField]: { $in: actor.branches } };
    return {};
  }

  // Throws unless the actor may see/act on a record belonging to this
  // employee/branch.
  assertCanAccess(actor: Actor, employeeId: string, branch?: string | string[]) {
    if (actor.scope === 'all' || String(employeeId) === actor.id) return;
    if (actor.scope === 'branch') {
      const branches = Array.isArray(branch) ? branch : [branch];
      if (branches.some((b) => b && actor.branches.includes(b))) return;
    }
    throw new ForbiddenException('You do not have access to this record');
  }

  // Restricts a requested branch filter to the actor's own branches.
  resolveBranchFilter(actor: Actor, requested?: string): string[] | null {
    const want = requested && requested !== 'all' ? [requested] : null;
    if (actor.scope === 'all') return want;
    const own = actor.branches;
    if (!want) return own;
    return want.filter((b) => own.includes(b));
  }
}
