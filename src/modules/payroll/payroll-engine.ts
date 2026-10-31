// Salary rules for one employee and one month. The payroll service loads the
// data; everything here is plain arithmetic, so a salary sheet, the salary
// simulator and the unit tests all run exactly the same rules.
import { diffDays } from '../../common/helpers/hr-date.helper';

export const WORKED_STATUSES = ['present', 'late', 'half_day', 'missing_punch'];

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const sumOf = (list: Array<{ amount: number }> = []) => list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
const keyOf = (s?: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const num = (v: any, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export type LineKind = 'earning' | 'deduction';
export interface PayLine {
  kind: LineKind;
  group: string; // allowance | commission | overtime | late | adjustment | loan | fixed
  label: string;
  amount: number;
  ref?: string;
}
export interface Explain {
  area: string;
  text: string;
  amount?: number;
  kind?: LineKind | 'info';
}

export interface DayRecord {
  date: string;
  status: string;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  leaveTypeName?: string;
  offDay?: string;
  remarks?: string;
}

export interface AppliesTo {
  designations?: string[];
  branches?: string[];
  roles?: string[];
  employeeTypes?: string[];
}

export interface EmployeeLike {
  _id?: any;
  name?: string;
  employeeId?: string;
  jobPosition?: string;
  branches?: string[];
  role?: string;
  employeeType?: string;
  status?: string;
  joiningDate?: string;
  lastWorkingDate?: string;
  basicSalary?: number;
  grossSalary?: number;
}

export interface AllowanceRuleLike {
  _id?: any;
  name: string;
  kind: 'roster_duty' | 'off_day_work' | 'perfect_attendance' | 'per_present_day' | 'monthly_fixed';
  amountType?: 'fixed' | 'day_rate';
  amount: number;
  dutyTypes?: string[];
  dayTypes?: string[];
  replacesOvertime?: boolean;
  maxAbsent?: number;
  maxLate?: number;
  appliesTo?: AppliesTo;
}

export interface CommissionPlanLike {
  _id?: any;
  name: string;
  ptSessionRate?: number;
  ptMonthlyRate?: number; // per monthly PT package client
  productItemRate?: number; // fixed amount per product sold
  ptSalesPercent?: number;
  membershipSalesPercent?: number;
  newMemberRate?: number;
  productSalesPercent?: number;
  targetMetric?: 'total_sales' | 'membership_sales' | 'pt_sales' | 'pt_sessions' | 'new_members';
  slabs?: Array<{ min: number; bonus: number }>;
  appliesTo?: AppliesTo;
}

export interface CommissionFigures {
  ptSessions?: number;
  ptMonthlyClients?: number;
  productItems?: number;
  ptSalesAmount?: number;
  membershipSalesAmount?: number;
  newMembers?: number;
  productSalesAmount?: number;
}

export interface PayInput {
  month: string;
  from: string;
  to: string;
  calendarDays: number;
  daysInMonth: number; // per-day divisor (calendar days or a fixed 30)
  currency?: string;
  payroll: { perDayBasis?: 'gross' | 'basic'; standardHoursPerDay?: number };
  emp: EmployeeLike;
  structure: {
    basic?: number;
    houseRent?: number;
    medical?: number;
    conveyance?: number;
    otherAllowances?: Array<{ name: string; amount: number }>;
    fixedDeductions?: Array<{ name: string; amount: number }>;
    gross?: number;
    paymentMode?: string;
    accountNumber?: string;
  } | null;
  days: DayRecord[];
  unpaidLeaveTypes?: string[];
  latePolicy?: any;
  overtimePolicy?: any;
  allowanceRules?: AllowanceRuleLike[];
  rosterDuties?: Array<{ date: string; dutyType: string }>;
  commission?: { _id?: any; planName?: string; total?: number; breakdown?: Array<{ label: string; amount: number }> } | null;
  manualOvertimeMinutes?: number; // approved overtime records entered by HR
  proxyDuties?: Array<{ _id?: any; dutyDate: string; proxyPayAmount: number; originalEmployeeName?: string }>;
  adjustments?: Array<{ _id?: any; type: string; title: string; amount: number }>;
  loans?: Array<{ _id?: any; type: string; loanNo: string; amount: number; recoveredAmount: number; installmentAmount: number }>;
}

export const DUTY_LABEL: Record<string, string> = {
  morning: 'Morning shift',
  evening: 'Evening shift',
  full_day: 'Full day',
  friday: 'Friday duty',
  special: 'Special duty',
  opening: 'Opening duty',
  closing: 'Closing duty',
  night: 'Night shift',
};

const money = (n: number, c = '৳') => `${c}${r2(n).toLocaleString('en-US')}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** True when a rule/plan/policy's "applies to" filters cover this employee (empty filter = everyone). */
export function coversEmployee(appliesTo: AppliesTo | undefined, emp: EmployeeLike) {
  const a = appliesTo || {};
  const one = (list: string[] | undefined, v?: string) => !list?.length || list.some((x) => keyOf(x) === keyOf(v) && keyOf(v) !== '');
  const any = (list: string[] | undefined, vs?: string[]) => !list?.length || (vs || []).some((v) => one(list, v));
  return one(a.designations, emp.jobPosition) && any(a.branches, emp.branches) && one(a.roles, emp.role) && one(a.employeeTypes, emp.employeeType);
}

/** Normalizes an "applies to" filter from a request body (trimmed, de-duplicated string lists). */
export function cleanAppliesTo(a: any): AppliesTo {
  const list = (v: any) => (Array.isArray(v) ? [...new Set(v.map((x: any) => String(x ?? '').trim()).filter(Boolean))].slice(0, 100) as string[] : []);
  return { designations: list(a?.designations), branches: list(a?.branches), roles: list(a?.roles), employeeTypes: list(a?.employeeTypes) };
}

/** "holiday" / "weekend" when the day was worked on an off day. Older records only say so in their remarks. */
export function offDayOf(d: DayRecord) {
  if (!WORKED_STATUSES.includes(d.status)) return '';
  if (d.offDay === 'holiday' || d.offDay === 'weekend') return d.offDay;
  if (/^Worked on holiday/i.test(d.remarks || '')) return 'holiday';
  if (/^Worked on day off/i.test(d.remarks || '')) return 'weekend';
  return '';
}

/** Whole months of service from the joining date up to `onDate` (null without a joining date). */
export function serviceMonths(joiningDate: string | undefined, onDate: string) {
  if (!joiningDate || !/^\d{4}-\d{2}-\d{2}/.test(joiningDate)) return null;
  const [y1, m1, d1] = joiningDate.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = onDate.slice(0, 10).split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

export function summarizeDays(days: DayRecord[], unpaidLeaveTypes: string[] = []) {
  const unpaid = new Set(unpaidLeaveTypes.map(keyOf));
  const s = { present: 0, absent: 0, late: 0, lateMinutes: 0, halfDay: 0, leave: 0, unpaidLeave: 0, missingPunch: 0, weekend: 0, holiday: 0, earlyLeave: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, offDaysWorked: 0 };
  for (const d of days) {
    if (WORKED_STATUSES.includes(d.status)) s.present++;
    if (d.isLate) {
      s.late++;
      s.lateMinutes += num(d.lateMinutes);
    }
    if (d.isEarlyLeave) {
      s.earlyLeave++;
      s.earlyLeaveMinutes += num(d.earlyLeaveMinutes);
    }
    if (d.status === 'half_day') s.halfDay++;
    if (d.status === 'absent') s.absent++;
    if (d.status === 'missing_punch') s.missingPunch++;
    if (d.status === 'weekend') s.weekend++;
    if (d.status === 'holiday') s.holiday++;
    if (d.status === 'leave') {
      s.leave++;
      if (unpaid.has(keyOf(d.leaveTypeName))) s.unpaidLeave++;
    }
    s.overtimeMinutes += num(d.overtimeMinutes);
    if (offDayOf(d)) s.offDaysWorked++;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Commission (personal training, membership and product sales)
// ---------------------------------------------------------------------------

export const COMMISSION_METRICS: Record<string, string> = {
  total_sales: 'total sales',
  membership_sales: 'membership sales',
  pt_sales: 'PT package sales',
  pt_sessions: 'PT sessions',
  new_members: 'new members',
};

export function calcCommission(plan: CommissionPlanLike, f: CommissionFigures, currency = '৳') {
  const v = {
    ptSessions: Math.max(0, num(f.ptSessions)),
    ptMonthlyClients: Math.max(0, num(f.ptMonthlyClients)),
    productItems: Math.max(0, num(f.productItems)),
    ptSalesAmount: Math.max(0, num(f.ptSalesAmount)),
    membershipSalesAmount: Math.max(0, num(f.membershipSalesAmount)),
    newMembers: Math.max(0, num(f.newMembers)),
    productSalesAmount: Math.max(0, num(f.productSalesAmount)),
  };
  const lines: Array<{ label: string; amount: number }> = [];
  const add = (label: string, amount: number) => {
    if (amount > 0) lines.push({ label, amount: r2(amount) });
  };
  add(`PT sessions: ${v.ptSessions} × ${money(num(plan.ptSessionRate), currency)}`, v.ptSessions * num(plan.ptSessionRate));
  add(`Monthly PT packages: ${v.ptMonthlyClients} client${v.ptMonthlyClients === 1 ? '' : 's'} × ${money(num(plan.ptMonthlyRate), currency)}`, v.ptMonthlyClients * num(plan.ptMonthlyRate));
  add(`PT package sales: ${num(plan.ptSalesPercent)}% of ${money(v.ptSalesAmount, currency)}`, (v.ptSalesAmount * num(plan.ptSalesPercent)) / 100);
  add(`Membership sales: ${num(plan.membershipSalesPercent)}% of ${money(v.membershipSalesAmount, currency)}`, (v.membershipSalesAmount * num(plan.membershipSalesPercent)) / 100);
  add(`New members: ${v.newMembers} × ${money(num(plan.newMemberRate), currency)}`, v.newMembers * num(plan.newMemberRate));
  add(`Supplement & product sales: ${num(plan.productSalesPercent)}% of ${money(v.productSalesAmount, currency)}`, (v.productSalesAmount * num(plan.productSalesPercent)) / 100);
  add(`Products sold: ${v.productItems} × ${money(num(plan.productItemRate), currency)}`, v.productItems * num(plan.productItemRate));

  const metricKey = plan.targetMetric || 'total_sales';
  const metric =
    metricKey === 'membership_sales'
      ? v.membershipSalesAmount
      : metricKey === 'pt_sales'
        ? v.ptSalesAmount
        : metricKey === 'pt_sessions'
          ? v.ptSessions
          : metricKey === 'new_members'
            ? v.newMembers
            : v.ptSalesAmount + v.membershipSalesAmount + v.productSalesAmount;
  const slab = [...(plan.slabs || [])].filter((s) => num(s.min) > 0 && metric >= num(s.min)).sort((a, b) => num(b.min) - num(a.min))[0];
  const isAmount = !['pt_sessions', 'new_members'].includes(metricKey);
  if (slab && num(slab.bonus) > 0) {
    add(`Target bonus: ${COMMISSION_METRICS[metricKey]} reached ${isAmount ? money(num(slab.min), currency) : num(slab.min)}`, num(slab.bonus));
  }
  return { lines, total: r2(sumOf(lines)), metric, slab: slab || null };
}

// ---------------------------------------------------------------------------
// Bonus policy (festival / performance / attendance / annual)
// ---------------------------------------------------------------------------

export interface BonusPolicyLike {
  policyName: string;
  bonusType?: string;
  calculationType?: 'percentage_of_basic' | 'percentage_of_gross' | 'fixed_amount' | string;
  bonusRate?: number;
  minServiceMonths?: number;
  proRata?: 'none' | 'service_months' | string;
  excludeProbation?: 'yes' | 'no' | string;
  maxAbsentDays?: number;
  maxLateDays?: number;
  appliesTo?: AppliesTo;
}

export function calcBonus(
  policy: BonusPolicyLike,
  emp: EmployeeLike,
  ctx: { basic: number; gross: number; onDate: string; absent?: number; late?: number; currency?: string },
) {
  const c = ctx.currency || '৳';
  const reasons: string[] = [];
  if (!coversEmployee(policy.appliesTo, emp)) return { eligible: false, covered: false, amount: 0, base: 0, service: null as number | null, reasons: ['Not covered by this policy'], basis: '' };
  const service = serviceMonths(emp.joiningDate, ctx.onDate);
  const minService = Math.max(0, num(policy.minServiceMonths));
  if (minService > 0 && service !== null && service < minService) reasons.push(`Service ${plural(service, 'month')} — needs ${minService}`);
  if (policy.excludeProbation === 'yes' && emp.status === 'probation') reasons.push('On probation');
  const maxAbsent = num(policy.maxAbsentDays, -1);
  const maxLate = num(policy.maxLateDays, -1);
  if (maxAbsent >= 0 && num(ctx.absent) > maxAbsent) reasons.push(`Absent ${plural(num(ctx.absent), 'day')} — limit ${maxAbsent}`);
  if (maxLate >= 0 && num(ctx.late) > maxLate) reasons.push(`Late ${plural(num(ctx.late), 'time')} — limit ${maxLate}`);

  const rate = Math.max(0, num(policy.bonusRate));
  let base = 0;
  let basis = '';
  let amount = 0;
  if (policy.calculationType === 'fixed_amount') {
    amount = rate;
    basis = `Fixed ${money(rate, c)}`;
  } else {
    base = policy.calculationType === 'percentage_of_gross' ? num(ctx.gross) : num(ctx.basic);
    amount = (base * rate) / 100;
    basis = `${rate}% of ${policy.calculationType === 'percentage_of_gross' ? 'gross' : 'basic'} ${money(base, c)}`;
  }
  if (policy.proRata === 'service_months' && service !== null && service < 12) {
    amount = (amount * service) / 12;
    basis += ` × ${service}/12 months`;
  }
  amount = Math.round(amount);
  if (amount <= 0 && !reasons.length) reasons.push(base === 0 && policy.calculationType !== 'fixed_amount' ? 'No salary set' : 'Amount is zero');
  return { eligible: reasons.length === 0, covered: true, amount: reasons.length ? 0 : amount, base, service, reasons, basis };
}

// ---------------------------------------------------------------------------
// Salary advance policy
// ---------------------------------------------------------------------------

export interface AdvancePolicyLike {
  policyName?: string;
  maxAdvancePercent?: number;
  maxAdvanceCount?: number;
  minServiceMonths?: number;
  maxInstallments?: number;
  maxAmount?: number;
  allowConcurrent?: 'yes' | 'no' | string;
  allowDuringProbation?: 'yes' | 'no' | string;
}

export function checkAdvance(
  policy: AdvancePolicyLike,
  ctx: { basic: number; joiningDate?: string; status?: string; today: string; amount: number; installmentAmount: number; activeAdvances: number; advancesThisYear: number; currency?: string },
) {
  const c = ctx.currency || '৳';
  const checks: Array<{ key: string; label: string; ok: boolean; detail: string }> = [];
  const service = serviceMonths(ctx.joiningDate, ctx.today);
  const minService = Math.max(0, num(policy.minServiceMonths));
  if (minService > 0) {
    checks.push({
      key: 'service',
      label: `At least ${plural(minService, 'month')} of service`,
      ok: service === null || service >= minService,
      detail: service === null ? 'No joining date on the profile' : `${plural(service, 'month')} of service`,
    });
  }
  if (policy.allowDuringProbation !== 'yes') {
    checks.push({ key: 'probation', label: 'Not on probation', ok: ctx.status !== 'probation', detail: ctx.status === 'probation' ? 'Employee is on probation' : 'Confirmed' });
  }
  const pct = Math.max(0, num(policy.maxAdvancePercent));
  const caps: number[] = [];
  // The policy page states the limit as a % of basic salary.
  if (pct > 0) caps.push((num(ctx.basic) * pct) / 100);
  if (num(policy.maxAmount) > 0) caps.push(num(policy.maxAmount));
  const maxAmount = caps.length ? Math.floor(Math.min(...caps)) : null;
  if (maxAmount !== null) {
    checks.push({
      key: 'amount',
      label: `Amount within limit (${[pct > 0 ? `${pct}% of basic` : '', num(policy.maxAmount) > 0 ? `max ${money(num(policy.maxAmount), c)}` : ''].filter(Boolean).join(', ')})`,
      ok: ctx.amount <= maxAmount,
      detail: `Up to ${money(maxAmount, c)}${num(ctx.basic) ? ` (basic ${money(ctx.basic, c)})` : ''}`,
    });
  }
  const maxInst = Math.max(0, num(policy.maxInstallments));
  if (maxInst > 0) {
    const months = ctx.amount > 0 ? Math.ceil(ctx.amount / Math.max(1, ctx.installmentAmount || ctx.amount)) : 0;
    checks.push({ key: 'installments', label: `Recovered within ${plural(maxInst, 'month')}`, ok: months <= maxInst, detail: `${plural(months, 'month')} at this installment` });
  }
  if (policy.allowConcurrent !== 'yes') {
    checks.push({ key: 'concurrent', label: 'No other advance still being recovered', ok: ctx.activeAdvances === 0, detail: ctx.activeAdvances ? `${plural(ctx.activeAdvances, 'advance')} still active` : 'None active' });
  }
  const maxCount = Math.max(0, num(policy.maxAdvanceCount));
  if (maxCount > 0) {
    checks.push({ key: 'count', label: `At most ${plural(maxCount, 'advance')} a year`, ok: ctx.advancesThisYear < maxCount, detail: `${ctx.advancesThisYear} taken this year` });
  }
  return { eligible: checks.every((x) => x.ok), checks, maxAmount, maxInstallments: maxInst || null, service };
}

// ---------------------------------------------------------------------------
// Monthly payslip
// ---------------------------------------------------------------------------

// Deduction for late arrivals (or early exits) beyond the monthly allowance.
function attendancePenalty(
  kind: 'late' | 'early',
  policy: any,
  events: Array<{ date: string; minutes: number }>,
  allowed: number,
  perDay: number,
  c: string,
) {
  const count = events.length;
  const word = kind === 'late' ? 'late arrival' : 'early exit';
  if (!count) return { amount: 0, text: '' };
  const type = policy.deductionType;
  const rate = num(policy.deductionAmount);
  if (type === 'fixed') {
    const beyond = Math.max(0, count - allowed);
    return { amount: beyond * rate, text: `${plural(count, word)}, ${allowed} allowed → ${beyond} × ${money(rate, c)}` };
  }
  if (type === 'per_minute') {
    const extra = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(allowed);
    const minutes = extra.reduce((s, e) => s + e.minutes, 0);
    return { amount: minutes * rate, text: `${plural(count, word)}, first ${allowed} allowed → ${minutes} min × ${money(rate, c)}` };
  }
  const per = Math.max(1, allowed || 3);
  const daysCut = Math.floor(count / per);
  return { amount: daysCut * perDay, text: `${plural(count, word)} → every ${per} = 1 day's pay (${plural(daysCut, 'day')})` };
}

export function computePayslip(input: PayInput) {
  const c = input.currency || '৳';
  const { emp, structure: st, from, to, calendarDays, daysInMonth } = input;
  const explain: Explain[] = [];
  const lines: PayLine[] = [];

  const basicFull = num(st?.basic) || num(emp.basicSalary);
  const grossFull = num(st?.gross) || num(emp.grossSalary) || basicFull;
  if (!grossFull) return { skipped: `${emp.name} (${emp.employeeId || 'no ID'}) — no salary set` } as const;

  // Pro-rate for joining / leaving inside the month.
  const startD = emp.joiningDate && emp.joiningDate > from ? emp.joiningDate : from;
  const endD = emp.lastWorkingDate && emp.lastWorkingDate < to ? emp.lastWorkingDate : to;
  const eligible = Math.max(0, diffDays(startD, endD) + 1);
  const factor = eligible >= calendarDays ? 1 : eligible / calendarDays;
  if (factor < 1) explain.push({ area: 'Salary', text: `Pro-rated for ${eligible} of ${calendarDays} days (${emp.joiningDate && emp.joiningDate > from ? `joined ${emp.joiningDate}` : `last day ${emp.lastWorkingDate}`})`, kind: 'info' });

  const basic = r2(basicFull * factor);
  const houseRent = r2(num(st?.houseRent) * factor);
  const medical = r2(num(st?.medical) * factor);
  const conveyance = r2(num(st?.conveyance) * factor);
  const otherAllowances = r2((st ? sumOf(st.otherAllowances) : Math.max(0, grossFull - basicFull)) * factor);
  const gross = r2(st ? basic + houseRent + medical + conveyance + otherAllowances : grossFull * factor);
  explain.push({ area: 'Salary', text: `Gross ${money(gross, c)} (basic ${money(basic, c)}${st ? '' : ', no salary structure — from profile'})`, amount: gross, kind: 'earning' });

  const days = input.days || [];
  const att = summarizeDays(days, input.unpaidLeaveTypes);
  const perDay = ((input.payroll.perDayBasis === 'basic' ? basicFull : grossFull) || 0) / daysInMonth;
  const worked = days.filter((d) => WORKED_STATUSES.includes(d.status));
  const workedDates = new Set(worked.map((d) => d.date));

  // Absent, unpaid leave and half days.
  const absentDeduction = r2((att.absent + att.unpaidLeave + att.halfDay * 0.5) * perDay);
  if (absentDeduction > 0) {
    explain.push({
      area: 'Absence',
      text: `${[att.absent ? plural(att.absent, 'absent day') : '', att.unpaidLeave ? plural(att.unpaidLeave, 'unpaid leave day') : '', att.halfDay ? plural(att.halfDay, 'half day') : ''].filter(Boolean).join(', ')} × day rate ${money(perDay, c)}`,
      amount: absentDeduction,
      kind: 'deduction',
    });
  }

  // Late arrivals and (optionally) early exits.
  const lp = input.latePolicy;
  let lateDeduction = 0;
  if (lp) {
    const lateEvents = days.filter((d) => d.isLate).map((d) => ({ date: d.date, minutes: num(d.lateMinutes) }));
    const late = attendancePenalty('late', lp, lateEvents, num(lp.maxLateAllowedPerMonth), perDay, c);
    if (late.amount > 0) {
      lateDeduction += late.amount;
      lines.push({ kind: 'deduction', group: 'late', label: 'Late arrival', amount: r2(late.amount) });
    }
    if (late.text) explain.push({ area: `Late policy (${lp.policyName || 'active'})`, text: late.text, amount: r2(late.amount), kind: 'deduction' });
    if (lp.earlyExitDeduction === 'yes') {
      const earlyEvents = days.filter((d) => d.isEarlyLeave).map((d) => ({ date: d.date, minutes: num(d.earlyLeaveMinutes) }));
      const early = attendancePenalty('early', lp, earlyEvents, num(lp.maxEarlyExitsAllowedPerMonth), perDay, c);
      if (early.amount > 0) {
        lateDeduction += early.amount;
        lines.push({ kind: 'deduction', group: 'late', label: 'Early exit', amount: r2(early.amount) });
      }
      if (early.text) explain.push({ area: 'Early exit', text: early.text, amount: r2(early.amount), kind: 'deduction' });
    }
  } else if (att.late) {
    explain.push({ area: 'Late policy', text: `${plural(att.late, 'late arrival')} — no active late policy, nothing deducted`, kind: 'info' });
  }
  lateDeduction = r2(lateDeduction);

  // Allowance rules that apply to this employee.
  const rules = (input.allowanceRules || []).filter((r) => coversEmployee(r.appliesTo, emp));
  const replacedOff = new Set<string>();
  for (const r of rules) if (r.kind === 'off_day_work' && r.replacesOvertime !== false) for (const t of r.dayTypes || []) replacedOff.add(t);

  // Overtime, day by day: minimum per day, rounding, day-off rate, monthly cap.
  const op = input.overtimePolicy;
  const rate = num(op?.ratePerHour) || 1.5;
  const offRate = num(op?.offDayRate) > 0 ? num(op.offDayRate) : rate;
  const minPerDay = Math.max(0, num(op?.minOvertimeMinutes));
  const roundTo = Math.max(0, num(op?.roundingMinutes));
  const cap = num(op?.maxHoursPerMonth) > 0 ? num(op.maxHoursPerMonth) : Infinity;
  let regMin = 0;
  let offMin = 0;
  let replacedMin = 0;
  let droppedMin = 0;
  for (const d of worked) {
    let m = num(d.overtimeMinutes);
    if (m <= 0) continue;
    if (m < minPerDay) {
      droppedMin += m;
      continue;
    }
    if (roundTo > 0) {
      droppedMin += m % roundTo;
      m -= m % roundTo;
    }
    const off = offDayOf(d);
    if (off && replacedOff.has(off)) replacedMin += m;
    else if (off) offMin += m;
    else regMin += m;
  }
  const manualMin = Math.max(0, num(input.manualOvertimeMinutes));
  regMin += manualMin;
  const regH = Math.min(regMin / 60, cap);
  const offH = Math.min(offMin / 60, Math.max(0, cap - regH));
  const hourly = basicFull / (daysInMonth * (num(input.payroll.standardHoursPerDay) || 8));
  const overtimePay = r2(regH * hourly * rate + offH * hourly * offRate);
  const overtimeHours = r2(regH + offH);
  if (overtimePay > 0) {
    if (regH > 0) lines.push({ kind: 'earning', group: 'overtime', label: `Overtime ${r2(regH)} h × ${rate}`, amount: r2(regH * hourly * rate) });
    if (offH > 0) lines.push({ kind: 'earning', group: 'overtime', label: `Day-off overtime ${r2(offH)} h × ${offRate}`, amount: r2(offH * hourly * offRate) });
  }
  if (regMin + offMin + replacedMin + droppedMin > 0) {
    const bits = [`${r2(overtimeHours)} h paid at hourly ${money(hourly, c)}`];
    if (offH > 0 && offRate !== rate) bits.push(`day-off hours at ×${offRate}`);
    if (regMin / 60 + offMin / 60 > cap) bits.push(`capped at ${cap} h/month`);
    if (droppedMin > 0) bits.push(`${droppedMin} min below the minimum or rounded off`);
    if (manualMin > 0) bits.push(`includes ${r2(manualMin / 60)} h from approved overtime records`);
    if (replacedMin > 0) bits.push(`${r2(replacedMin / 60)} h on off days paid as duty pay instead`);
    explain.push({ area: `Overtime${op?.policyName ? ` (${op.policyName})` : ''}`, text: bits.join('; '), amount: overtimePay, kind: 'earning' });
  }

  // Allowances & duty pay.
  let allowancePay = 0;
  const addAllowance = (label: string, amount: number, ref?: string, why?: string) => {
    const a = r2(amount);
    if (a <= 0) return;
    allowancePay += a;
    lines.push({ kind: 'earning', group: 'allowance', label, amount: a, ...(ref ? { ref } : {}) });
    explain.push({ area: 'Allowance', text: why || label, amount: a, kind: 'earning' });
  };
  const absentish = att.absent + att.unpaidLeave;
  for (const r of rules) {
    const amt = num(r.amount);
    const ref = r._id ? String(r._id) : undefined;
    if (r.kind === 'roster_duty') {
      const types = new Set(r.dutyTypes || []);
      const n = (input.rosterDuties || []).filter((d) => types.has(d.dutyType) && workedDates.has(d.date)).length;
      if (n) {
        const dayRate = r.amountType === 'day_rate';
        const unit = dayRate ? amt * perDay : amt;
        const each = dayRate ? `${amt} × day rate ${money(perDay, c)}` : money(amt, c);
        addAllowance(`${r.name} (${n} × ${dayRate ? `${amt} day's pay` : money(amt, c)})`, n * unit, ref, `${r.name}: ${plural(n, 'duty', 'duties')} attended (${[...types].map((t) => DUTY_LABEL[t] || t).join(', ')}) × ${each}`);
      }
    } else if (r.kind === 'off_day_work') {
      const types = new Set(r.dayTypes || []);
      const n = worked.filter((d) => types.has(offDayOf(d))).length;
      if (n) {
        const unit = r.amountType === 'day_rate' ? amt * perDay : amt;
        addAllowance(`${r.name} (${plural(n, 'day')})`, n * unit, ref, `${r.name}: worked ${plural(n, 'off day')} × ${r.amountType === 'day_rate' ? `${amt} × day rate ${money(perDay, c)}` : money(amt, c)}`);
      }
    } else if (r.kind === 'perfect_attendance') {
      const maxAbsent = Math.max(0, num(r.maxAbsent));
      const maxLate = Math.max(0, num(r.maxLate));
      if (factor < 1) explain.push({ area: 'Allowance', text: `${r.name}: not paid — not employed the whole month`, kind: 'info' });
      else if (!att.present) explain.push({ area: 'Allowance', text: `${r.name}: not paid — no attendance this month`, kind: 'info' });
      else if (absentish > maxAbsent || att.late > maxLate) explain.push({ area: 'Allowance', text: `${r.name}: not paid — ${absentish} absent (limit ${maxAbsent}), ${att.late} late (limit ${maxLate})`, kind: 'info' });
      else addAllowance(r.name, amt, ref, `${r.name}: ${absentish} absent, ${att.late} late — within limits`);
    } else if (r.kind === 'per_present_day') {
      if (att.present) addAllowance(`${r.name} (${att.present} × ${money(amt, c)})`, att.present * amt, ref, `${r.name}: ${plural(att.present, 'day')} worked × ${money(amt, c)}`);
    } else if (r.kind === 'monthly_fixed') {
      addAllowance(r.name, amt * factor, ref, `${r.name}: ${money(amt, c)} a month${factor < 1 ? ' (pro-rated)' : ''}`);
    }
  }
  for (const p of input.proxyDuties || []) {
    const when = new Date(`${p.dutyDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    addAllowance(`Proxy duty ${when}${p.originalEmployeeName ? ` (for ${p.originalEmployeeName})` : ''}`, num(p.proxyPayAmount), p._id ? String(p._id) : undefined);
  }
  allowancePay = r2(allowancePay);

  // Approved commission for the month.
  let commission = 0;
  if (input.commission) {
    for (const b of input.commission.breakdown || []) {
      const a = r2(b.amount);
      if (a <= 0) continue;
      commission += a;
      lines.push({ kind: 'earning', group: 'commission', label: b.label, amount: a, ...(input.commission._id ? { ref: String(input.commission._id) } : {}) });
    }
    commission = r2(commission);
    if (commission > 0) explain.push({ area: `Commission${input.commission.planName ? ` (${input.commission.planName})` : ''}`, text: `${plural((input.commission.breakdown || []).length, 'item')} from the approved commission sheet`, amount: commission, kind: 'earning' });
  }

  // Manual adjustments (bonus, arrears, deductions...).
  let bonus = 0;
  let otherEarnings = 0;
  let otherDeductions = 0;
  for (const a of input.adjustments || []) {
    const amt = num(a.amount);
    if (a.type === 'bonus' || a.type === 'incentive') bonus += amt;
    else if (a.type === 'deduction') otherDeductions += amt;
    else otherEarnings += amt;
    lines.push({ kind: a.type === 'deduction' ? 'deduction' : 'earning', group: 'adjustment', label: a.title, amount: amt, ...(a._id ? { ref: String(a._id) } : {}) });
    explain.push({ area: a.type === 'deduction' ? 'Deduction' : a.type === 'bonus' || a.type === 'incentive' ? 'Bonus' : 'Adjustment', text: a.title, amount: amt, kind: a.type === 'deduction' ? 'deduction' : 'earning' });
  }

  // Advance / loan installments. Labels and refs are what finalize() books.
  let advanceDeduction = 0;
  let loanDeduction = 0;
  for (const l of input.loans || []) {
    const remaining = r2(num(l.amount) - num(l.recoveredAmount));
    const ded = Math.min(num(l.installmentAmount), remaining);
    if (ded <= 0) continue;
    if (l.type === 'advance') advanceDeduction += ded;
    else loanDeduction += ded;
    lines.push({ kind: 'deduction', group: 'loan', label: `${l.type === 'advance' ? 'Advance' : 'Loan'} ${l.loanNo}`, amount: ded, ...(l._id ? { ref: String(l._id) } : {}) });
    explain.push({ area: l.type === 'advance' ? 'Advance' : 'Loan', text: `${l.loanNo}: installment ${money(ded, c)}, ${money(remaining - ded, c)} left after this month`, amount: ded, kind: 'deduction' });
  }

  const fixedDeductions = r2(st ? sumOf(st.fixedDeductions) : 0);
  for (const f of st?.fixedDeductions || []) {
    lines.push({ kind: 'deduction', group: 'fixed', label: f.name, amount: num(f.amount) });
    explain.push({ area: 'Fixed deduction', text: f.name, amount: num(f.amount), kind: 'deduction' });
  }

  const totalEarnings = r2(gross + overtimePay + allowancePay + commission + bonus + otherEarnings);
  const totalDeductions = r2(lateDeduction + absentDeduction + advanceDeduction + loanDeduction + fixedDeductions + otherDeductions);
  const remarks: string[] = [];
  if (factor < 1) remarks.push(`Pro-rated ${eligible}/${calendarDays} days`);
  if (!days.length) remarks.push('No attendance data for this month');

  return {
    skipped: null,
    paymentMode: st?.paymentMode || 'cash',
    accountNumber: st?.accountNumber || '',
    attendance: {
      daysInMonth,
      present: att.present,
      absent: att.absent,
      late: att.late,
      lateMinutes: att.lateMinutes,
      halfDay: att.halfDay,
      leave: att.leave,
      unpaidLeave: att.unpaidLeave,
      weekend: att.weekend,
      holiday: att.holiday,
      earlyLeave: att.earlyLeave,
      offDaysWorked: att.offDaysWorked,
      overtimeHours,
    },
    basic,
    houseRent,
    medical,
    conveyance,
    otherAllowances,
    gross,
    overtimePay,
    allowancePay,
    commission,
    bonus: r2(bonus),
    otherEarnings: r2(otherEarnings),
    totalEarnings,
    lateDeduction,
    absentDeduction,
    advanceDeduction: r2(advanceDeduction),
    loanDeduction: r2(loanDeduction),
    fixedDeductions,
    otherDeductions: r2(otherDeductions),
    totalDeductions,
    netSalary: Math.round(Math.max(0, totalEarnings - totalDeductions)),
    lines,
    remarks: remarks.join('; '),
    explain,
    perDay: r2(perDay),
    hourly: r2(hourly),
  };
}
