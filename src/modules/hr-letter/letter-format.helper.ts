// Formatting helpers for HR letter snapshots. Letters are printed in Bangla,
// so dates render as "২১ অক্টোবর, ২০২৬" and money as "৳ 25,000/-", while
// the raw values stay in inputData for re-editing / reissue.

export type LetterFieldType = 'text' | 'textarea' | 'date' | 'money' | 'percent' | 'number';

export const LETTER_FIELD_TYPES: LetterFieldType[] = ['text', 'textarea', 'date', 'money', 'percent', 'number'];

// Older templates (and the seeded defaults) have no `type` on their info
// fields, so it is inferred from the key naming convention.
export function inferFieldType(key: string): LetterFieldType {
  const k = String(key || '').toLowerCase();
  if (k.endsWith('date') || k.endsWith('deadline')) return 'date';
  if (k.endsWith('salary') || k.endsWith('amount')) return 'money';
  if (k.endsWith('percentage') || k.endsWith('percent')) return 'percent';
  if (k.endsWith('description') || k.endsWith('reason')) return 'textarea';
  return 'text';
}

export const fieldTypeOf = (field: { key: string; type?: string }): LetterFieldType =>
  (LETTER_FIELD_TYPES as string[]).includes(field?.type || '') ? (field.type as LetterFieldType) : inferFieldType(field?.key);

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toLatinDigits = (s: string) => String(s ?? '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

// Accepts "2026-10-21", a full ISO timestamp or a Date. Returns '' when the
// value is not a recognisable date so callers can fall back to the raw text.
export function formatBanglaDate(value: any): string {
  if (!value) return '';
  let d: Date;
  if (value instanceof Date) d = value;
  else {
    const s = toLatinDigits(String(value)).trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return '';
    d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  }
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const parseAmount = (value: any): number | null => {
  const s = toLatinDigits(String(value ?? '')).replace(/[,\s]/g, '').replace(/[^\d.]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function formatMoney(value: any, symbol = '৳'): string {
  const raw = String(value ?? '').trim();
  // Already-written text like "আলোচনা সাপেক্ষে" is kept as typed.
  if (!/^[\s৳$,.\d০-৯]+(\/-)?(\s*(টাকা|tk|taka|bdt))?$/i.test(raw)) return raw;
  const n = parseAmount(raw);
  if (n === null) return raw;
  return `${symbol} ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-`;
}

// Display string for one info-table value according to its field type.
export function formatFieldValue(type: LetterFieldType, value: any, currencySymbol = '৳'): string {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  switch (type) {
    case 'date':
      return formatBanglaDate(value) || String(value);
    case 'money':
      return formatMoney(value, currencySymbol);
    case 'percent': {
      const s = String(value).trim();
      return /%$/.test(s) ? s : `${s}%`;
    }
    default:
      return String(value);
  }
}

// Replaces {{key}} placeholders. Unknown keys are left blank rather than
// printing raw braces on an official letter.
export function fillPlaceholders(text: string, vars: Record<string, any>): string {
  if (!text) return text;
  return String(text).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}
