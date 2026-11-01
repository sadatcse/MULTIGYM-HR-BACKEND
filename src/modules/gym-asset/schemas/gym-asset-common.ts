// Values shared by the gym asset schemas, DTOs and services.

export const ASSET_CONDITIONS = ['new', 'excellent', 'good', 'fair', 'damaged', 'under_maintenance', 'non_functional', 'disposed'] as const;
export const ASSET_STATUSES = ['active', 'disposed'] as const;
export const MAINTENANCE_TYPES = ['preventive', 'repair', 'servicing', 'inspection', 'replacement', 'other'] as const;
export const MAINTENANCE_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const DISPOSAL_TYPES = ['sold', 'damaged', 'lost', 'donated', 'scrapped', 'other'] as const;
export const HISTORY_EVENTS = [
  'created',
  'updated',
  'category_changed',
  'location_changed',
  'place_changed',
  'transferred',
  'split',
  'maintenance_logged',
  'maintenance_started',
  'maintenance_completed',
  'maintenance_cancelled',
  'condition_changed',
  'disposed',
  'deleted',
] as const;

// Who did something, kept as a snapshot so renamed/removed staff still read right.
export const ACTOR_SHAPE = { id: { type: String, default: '' }, name: { type: String, default: '' } };
export type ActorRef = { id: string; name: string };

// A location or place as it was at the time of a record.
export const REF_SHAPE = { id: { type: String, default: '' }, name: { type: String, default: '' } };
export type NamedRef = { id: string; name: string };

export const FILE_SHAPE = [{ name: { type: String, default: '' }, url: { type: String, required: true } }];
export type FileRef = { name: string; url: string };
