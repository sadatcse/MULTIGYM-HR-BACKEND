const EXPIRING_SOON_WINDOW_DAYS = 30;

export type ExpiryStatus = 'active' | 'expiring-soon' | 'expired' | 'none';

// Shared "is this end date coming up / already passed" classifier, used for
// both purchase warranties and vendor contracts so the "expiring soon"
// window (and its definition) stays consistent across the module.
export function computeExpiryStatus(endDate?: Date | string | null, hasValue = true): ExpiryStatus {
  if (!hasValue || !endDate) return 'none';
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return 'none';

  const diffDays = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'expired';
  if (diffDays <= EXPIRING_SOON_WINDOW_DAYS) return 'expiring-soon';
  return 'active';
}
