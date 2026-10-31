// Date helpers for the HR modules. Business dates are stored as
// "YYYY-MM-DD" strings (matching Employee.joiningDate and the gym calendar),
// and wall-clock times as "HH:mm", so a day never shifts when the server and
// the gym run in different timezones. Conversions to/from an absolute
// instant take an explicit UTC offset in minutes (Dhaka = 360).

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function isDateStr(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isMonthStr(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

export function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: string, days: number): string {
  const d = parseDateStr(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseDateStr(to).getTime() - parseDateStr(from).getTime()) / 86400000);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

export function dayName(s: string): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parseDateStr(s).getUTCDay()];
}

export function monthRange(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad2(days)}`, days };
}

// "Today" in the business timezone.
export function todayStr(offsetMinutes = 360): string {
  return toDateStr(new Date(Date.now() + offsetMinutes * 60000));
}

// Wall-clock "HH:mm" -> minutes since midnight. Returns null for blanks.
// "HH:mm" or "h:mm AM/PM" → minutes after midnight. Duty times saved from
// the duty-time page use the 12-hour form ("03:00 PM").
export function timeToMinutes(t?: string): number | null {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    const pm = m[3].toUpperCase() === 'PM';
    h = (h % 12) + (pm ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** Any accepted time form → "HH:mm" ('' when unreadable). */
export function normalizeTime(t?: string): string {
  const v = timeToMinutes(t);
  return v === null ? '' : `${pad2(Math.floor(v / 60))}:${pad2(v % 60)}`;
}

export function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

// Local wall-clock date+time in the business timezone -> absolute instant.
export function localToInstant(date: string, time: string, offsetMinutes = 360): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s || 0) - offsetMinutes * 60000);
}

// Absolute instant -> local { date, time } in the business timezone.
export function instantToLocal(instant: Date, offsetMinutes = 360): { date: string; time: string; minutes: number } {
  const shifted = new Date(instant.getTime() + offsetMinutes * 60000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { date: toDateStr(shifted), time: minutesToTime(minutes), minutes };
}

// Sequential human-readable reference numbers (REQ-2026-0001 etc.).
export function formatRefNo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
