// Bangladeshi mobile numbers arrive as "01711-234567", "+8801711234567",
// "8801711234567" or "1711234567". They are stored and compared as the
// 11-digit local form, 01XXXXXXXXX.

/** Normalised 01XXXXXXXXX, or null when the text is not a valid BD mobile number. */
export function normalizeMobile(value?: string | null): string | null {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = `0${d}`;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

/** Every stored spelling of one number, for lookups that must match older records. */
export const mobileVariants = (normalized: string) => [normalized, `+88${normalized}`, `88${normalized}`];

/** True when the login text looks like a phone number rather than an email. */
export const looksLikeMobile = (value: string) => !value.includes('@') && /^[\d\s+()-]{6,}$/.test(value.trim());
