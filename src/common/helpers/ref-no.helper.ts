import { Model } from 'mongoose';
import { formatRefNo } from './hr-date.helper';

// Next "PREFIX-YYYY-NNNN" number for a collection, based on the highest
// existing number for that prefix/year (so deletions never cause reuse of a
// lower number). Callers retry on a duplicate-key error for the rare race
// where two documents are created in the same instant.
export async function nextRefNo(model: Model<any>, field: string, prefix: string, year = new Date().getFullYear()) {
  const base = `${prefix}-${year}-`;
  const last = await model
    .findOne({ [field]: { $regex: `^${base}\\d+$` } })
    .sort({ [field]: -1 })
    .select(field)
    .lean();
  const lastSeq = last ? parseInt(String((last as any)[field]).slice(base.length), 10) || 0 : 0;
  return formatRefNo(prefix, year, lastSeq + 1);
}

export async function createWithRefNo<T>(model: Model<any>, field: string, prefix: string, payload: Record<string, any>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const refNo = await nextRefNo(model, field, prefix);
    try {
      return (await model.create({ ...payload, [field]: refNo })) as T;
    } catch (e: any) {
      if (e?.code !== 11000 || attempt === 4) throw e;
    }
  }
  throw new Error('Could not allocate a reference number');
}
