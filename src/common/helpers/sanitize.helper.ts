import { NextFunction, Request, Response } from 'express';

export const escapeRegex = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Free-text search params. Every service uses these as literal text inside a
// $regex, so they are escaped once here (prevents regex injection / ReDoS).
const SEARCH_KEYS = new Set(['search', 'q', 'term', 'keyword']);
const MAX_SEARCH = 100;

// Removes MongoDB operator keys ("$gt", "a.b") anywhere in a value so query
// strings like ?status[$ne]=x or JSON bodies like {"role":{"$gt":""}} can
// never turn into operators inside a filter or update.
function stripOperators(value: any, depth = 0): any {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  if (Buffer.isBuffer(value) || value instanceof Date) return value;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) delete value[key];
    else value[key] = stripOperators(value[key], depth + 1);
  }
  return value;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') stripOperators(req.body);
  const q: any = req.query;
  if (q && typeof q === 'object') {
    for (const key of Object.keys(q)) {
      const v = q[key];
      // Query params are scalars in this API; nested objects only ever come
      // from operator-injection attempts.
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        delete q[key];
        continue;
      }
      if (SEARCH_KEYS.has(key) && typeof v === 'string') q[key] = escapeRegex(v.slice(0, MAX_SEARCH));
    }
  }
  next();
}
