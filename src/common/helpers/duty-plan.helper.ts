// An employee's weekly duty plan is a list of entries — branch, weekdays and
// one in/out window each. Several entries give multi-branch staff, split
// shifts (two windows the same day) and different times per day.
import { minutesToTime, normalizeTime, timeToMinutes } from './hr-date.helper';

export const WEEK_DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
// Friday is the weekly day off; an entry without days means Saturday–Thursday.
export const WORK_DAYS = WEEK_DAYS.filter((d) => d !== 'friday');
const daysOf = (e: any) => (e?.days?.length ? e.days.map((d: string) => String(d).toLowerCase()) : WORK_DAYS);

export interface DutyEntry {
  branch: string;
  days: string[];
  inTime: string;
  outTime: string;
  shift?: string;
  workSchedule?: string;
  notes?: string;
}

/** Validates and normalizes a plan from a request body (24-hour times, known weekdays). */
export function cleanDutyPlan(list: any, branches: string[]): { entries: DutyEntry[]; errors: string[] } {
  const errors: string[] = [];
  const known = new Map(branches.map((b) => [b.trim().toLowerCase(), b]));
  const entries: DutyEntry[] = [];
  (Array.isArray(list) ? list : []).slice(0, 60).forEach((e: any, i: number) => {
    const n = i + 1;
    const branch = known.get(String(e?.branch || '').trim().toLowerCase());
    const inTime = normalizeTime(e?.inTime);
    const outTime = normalizeTime(e?.outTime);
    const days = [...new Set((Array.isArray(e?.days) ? e.days : []).map((d: any) => String(d).trim().toLowerCase()).filter((d: string) => WEEK_DAYS.includes(d)))] as string[];
    if (!branch) errors.push(`Row ${n}: choose a branch`);
    if (!inTime || !outTime) errors.push(`Row ${n}: enter both in and out time`);
    else if (inTime === outTime) errors.push(`Row ${n}: in and out time are the same`);
    if (branch && inTime && outTime && inTime !== outTime) {
      entries.push({ branch, days: days.length ? WEEK_DAYS.filter((d) => days.includes(d)) : [...WORK_DAYS], inTime, outTime, notes: String(e?.notes || '').trim().slice(0, 120) });
    }
  });
  // Overlapping windows on the same day are almost always a typing mistake.
  for (const day of WEEK_DAYS) {
    const today = entries.filter((e) => daysOf(e).includes(day)).map((e) => {
      const a = timeToMinutes(e.inTime)!;
      let b = timeToMinutes(e.outTime)!;
      if (b <= a) b += 1440;
      return { a, b, e };
    });
    today.sort((x, y) => x.a - y.a);
    for (let i = 1; i < today.length; i++) {
      if (today[i].a < today[i - 1].b) {
        errors.push(`${day[0].toUpperCase()}${day.slice(1)}: ${today[i - 1].e.branch} ${today[i - 1].e.inTime}–${today[i - 1].e.outTime} overlaps ${today[i].e.branch} ${today[i].e.inTime}–${today[i].e.outTime}`);
        break;
      }
    }
  }
  return { entries, errors };
}

/**
 * The expected duty window on a weekday: earliest start to latest end across
 * every entry for that day (all branches, all slots). 'off' on a weekday no
 * entry covers (Friday unless an entry names it); null without a plan.
 */
export function dutyWindow(entries: any[] | undefined, day: string): { start: string; end: string; slots: number } | 'off' | null {
  const valid = (entries || []).filter((e) => timeToMinutes(e?.inTime) !== null && timeToMinutes(e?.outTime) !== null);
  if (!valid.length) return null;
  const today = valid.filter((e) => daysOf(e).includes(day));
  if (!today.length) return 'off';
  let start = Infinity;
  let end = -Infinity;
  for (const e of today) {
    const a = timeToMinutes(e.inTime)!;
    let b = timeToMinutes(e.outTime)!;
    if (b <= a) b += 1440;
    start = Math.min(start, a);
    end = Math.max(end, b);
  }
  return { start: minutesToTime(start), end: minutesToTime(end % 1440), slots: today.length };
}
