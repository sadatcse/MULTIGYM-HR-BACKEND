import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { escapeRegex, GymAssetCoreService, round2, toDate, valuesOf } from './gym-asset-core.service';
import { GymAssetMaintenance, GymAssetMaintenanceDocument, GymAssetTransfer, GymAssetTransferDocument } from './schemas/gym-asset-records.schema';
import { ASSET_CONDITIONS } from './schemas/gym-asset-common';

export const REPORT_TYPES = ['location', 'place', 'category', 'condition', 'transfers', 'recent-transfers', 'maintenance', 'warranty', 'recent-assets', 'audit'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const DAY = 24 * 3600 * 1000;
const EXPORT_CAP = 10000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Totals = { lines: number; units: number; purchaseValue: number; currentValue: number };
const zero = (): Totals => ({ lines: 0, units: 0, purchaseValue: 0, currentValue: 0 });
const add = (t: Totals, a: any, v: { purchaseValue: number; currentValue: number }) => {
  t.lines += 1;
  t.units += a.quantity || 0;
  t.purchaseValue += v.purchaseValue;
  t.currentValue += v.currentValue;
};
const tidy = <T extends Totals>(t: T): T => ({ ...t, purchaseValue: round2(t.purchaseValue), currentValue: round2(t.currentValue) });

@Injectable()
export class GymAssetReportService {
  constructor(
    private readonly core: GymAssetCoreService,
    @InjectModel(GymAssetTransfer.name) private readonly transferModel: Model<GymAssetTransferDocument>,
    @InjectModel(GymAssetMaintenance.name) private readonly maintenanceModel: Model<GymAssetMaintenanceDocument>,
  ) {}

  async run(type: string, q: Record<string, any>) {
    if (!REPORT_TYPES.includes(type as ReportType)) throw new BadRequestException('Unknown report');
    const exportAll = q.export === '1' || q.export === 'true';
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = exportAll ? EXPORT_CAP : Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
    const ctx = { q, page, limit, skip: exportAll ? 0 : (page - 1) * limit };
    switch (type as ReportType) {
      case 'location':
      case 'place':
      case 'category':
      case 'condition':
        return this.summary(type as 'location' | 'place' | 'category' | 'condition', q);
      case 'transfers':
      case 'recent-transfers':
        return this.transfers(ctx, type === 'recent-transfers');
      case 'maintenance':
        return this.maintenance(ctx);
      case 'warranty':
        return this.warranty(ctx);
      case 'recent-assets':
      case 'audit':
        return this.register(ctx, type === 'recent-assets');
    }
  }

  /** Assets grouped by location / place / category / condition with counts and values. */
  private async summary(by: 'location' | 'place' | 'category' | 'condition', q: Record<string, any>) {
    // The condition report includes disposed lines unless a status is picked.
    const filter = this.core.assetFilter({ ...q, status: q.status || (by === 'condition' ? 'all' : 'active') }, { dateField: 'purchaseDate' });
    const [assets, rates] = await Promise.all([
      this.core.assetModel.find(filter).select('location place category condition status quantity unitPrice purchaseDate').lean(),
      this.core.rates(),
    ]);
    const groups = new Map<string, Totals & { damaged: number; maintenance: number }>();
    const total = { ...zero(), damaged: 0, maintenance: 0 };
    for (const a of assets) {
      const key = by === 'condition' ? a.condition : String((a as any)[by]);
      const g = groups.get(key) || { ...zero(), damaged: 0, maintenance: 0 };
      const v = valuesOf(a, rates.get(String(a.category))?.depreciationRate || 0);
      for (const t of [g, total]) {
        add(t, a, v);
        if (['damaged', 'non_functional'].includes(a.condition)) t.damaged += 1;
        if (a.condition === 'under_maintenance') t.maintenance += 1;
      }
      groups.set(key, g);
    }

    let rows: any[] = [];
    if (by === 'condition') {
      rows = ASSET_CONDITIONS.map((c) => ({ key: c, condition: c, ...tidy(groups.get(c) || { ...zero(), damaged: 0, maintenance: 0 }) }));
    } else if (by === 'category') {
      const cats = await this.core.categoryModel.find(q.category && q.category !== 'all' ? { _id: q.category } : {}).select('name status depreciationRate').sort({ name: 1 }).lean();
      rows = cats.map((c) => ({ key: String(c._id), category: c.name, depreciationRate: c.depreciationRate, inactive: c.status !== 'active', ...tidy(groups.get(String(c._id)) || { ...zero(), damaged: 0, maintenance: 0 }) }));
    } else if (by === 'location') {
      const locs = await this.core.locationModel.find(q.location && q.location !== 'all' ? { _id: q.location } : {}).select('name type status').sort({ name: 1 }).lean();
      rows = locs.map((l) => ({ key: String(l._id), location: l.name, type: l.type, inactive: l.status !== 'active', ...tidy(groups.get(String(l._id)) || { ...zero(), damaged: 0, maintenance: 0 }) }));
    } else {
      const placeFilter: Record<string, any> = {};
      if (q.location && q.location !== 'all') placeFilter.location = q.location;
      if (q.place && q.place !== 'all') placeFilter._id = q.place;
      const places = await this.core.placeModel.find(placeFilter).select('name location status').populate('location', 'name').lean();
      rows = places
        .map((p: any) => ({ key: String(p._id), location: p.location?.name || '—', place: p.name, inactive: p.status !== 'active', ...tidy(groups.get(String(p._id)) || { ...zero(), damaged: 0, maintenance: 0 }) }))
        .sort((a, b) => a.location.localeCompare(b.location) || a.place.localeCompare(b.place));
    }
    return { type: by, rows, totals: tidy(total), total: rows.length, page: 1, totalPages: 1 };
  }

  private recordFilter(q: Record<string, any>, dateField: string, locationFields: string[], recent: boolean) {
    const filter: Record<string, any> = {};
    let from = q.from;
    if (recent && !q.from && !q.to) from = iso(new Date(Date.now() - 30 * DAY));
    if (from || q.to) {
      filter[dateField] = {};
      if (from) filter[dateField].$gte = toDate(from);
      if (q.to) filter[dateField].$lte = new Date(`${String(q.to).slice(0, 10)}T23:59:59.999Z`);
    }
    if (q.location && q.location !== 'all') filter.$or = locationFields.map((f) => ({ [f]: q.location }));
    // "Person" on record reports = who recorded the transfer / maintenance.
    if (q.person && q.person !== 'all') filter['by.name'] = q.person;
    if (q.search?.trim()) {
      const re = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
      filter.$and = [{ $or: [{ assetCode: re }, { assetName: re }] }];
    }
    return { filter, from };
  }

  /** Narrows record reports by the asset's current category / place / condition. */
  private async assetIdsFor(q: Record<string, any>) {
    const keys = ['category', 'place', 'condition'].filter((k) => q[k] && q[k] !== 'all');
    if (!keys.length) return null;
    const ids = await this.core.assetModel.find(this.core.assetFilter({ category: q.category, place: q.place, condition: q.condition, status: 'all' })).distinct('_id');
    return ids as Types.ObjectId[];
  }

  private async transfers({ q, skip, limit, page }: any, recent: boolean) {
    const { filter, from } = this.recordFilter(q, 'transferDate', ['fromLocation.id', 'toLocation.id'], recent);
    if (q.place && q.place !== 'all') filter.$and = [...(filter.$and || []), { $or: [{ 'fromPlace.id': q.place }, { 'toPlace.id': q.place }] }];
    const ids = await this.assetIdsFor({ ...q, place: undefined });
    if (ids) filter.$and = [...(filter.$and || []), { $or: [{ asset: { $in: ids } }, { movedAsset: { $in: ids } }] }];
    const [total, rows] = await Promise.all([this.transferModel.countDocuments(filter), this.transferModel.find(filter).sort({ transferDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean()]);
    return { type: recent ? 'recent-transfers' : 'transfers', rows, totals: { lines: total, units: rows.reduce((s, r) => s + r.quantity, 0) }, total, page, totalPages: Math.max(1, Math.ceil(total / limit)), from };
  }

  private async maintenance({ q, skip, limit, page }: any) {
    const { filter } = this.recordFilter(q, 'maintenanceDate', ['location.id'], false);
    if (q.place && q.place !== 'all') filter['place.id'] = q.place;
    if (q.maintenanceStatus && q.maintenanceStatus !== 'all') filter.status = q.maintenanceStatus;
    const ids = await this.assetIdsFor({ ...q, place: undefined });
    if (ids) filter.asset = { $in: ids };
    const [total, rows, sums] = await Promise.all([
      this.maintenanceModel.countDocuments(filter),
      this.maintenanceModel.find(filter).sort({ maintenanceDate: -1 }).skip(skip).limit(limit).lean(),
      this.maintenanceModel.aggregate([{ $match: filter }, { $group: { _id: null, cost: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$cost'] } } } }]),
    ]);
    return { type: 'maintenance', rows, totals: { lines: total, cost: round2(sums[0]?.cost || 0) }, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private async warranty({ q, skip, limit, page }: any) {
    const filter = this.core.assetFilter({ ...q, status: q.status || 'active' });
    filter.warrantyExpiry = { $ne: null };
    if (q.from || q.to) {
      if (q.from) filter.warrantyExpiry.$gte = toDate(q.from);
      if (q.to) filter.warrantyExpiry.$lte = new Date(`${String(q.to).slice(0, 10)}T23:59:59.999Z`);
    }
    const [total, rows] = await Promise.all([
      this.core.assetModel.countDocuments(filter),
      this.core.assetModel.find(filter).select('assetCode name location place category purchaseDate warrantyExpiry warrantyMonths supplier condition').populate('location', 'name').populate('place', 'name').populate('category', 'name').sort({ warrantyExpiry: 1 }).skip(skip).limit(limit).lean(),
    ]);
    const today = new Date(`${iso(new Date())}T00:00:00.000Z`).getTime();
    const data = rows.map((a: any) => ({ ...a, daysLeft: Math.round((new Date(a.warrantyExpiry).getTime() - today) / DAY) }));
    const counts = await this.core.assetModel.aggregate([
      { $match: filter },
      { $group: { _id: null, expired: { $sum: { $cond: [{ $lt: ['$warrantyExpiry', new Date(today)] }, 1, 0] } }, soon: { $sum: { $cond: [{ $and: [{ $gte: ['$warrantyExpiry', new Date(today)] }, { $lte: ['$warrantyExpiry', new Date(today + 30 * DAY)] }] }, 1, 0] } } } },
    ]);
    return { type: 'warranty', rows: data, totals: { lines: total, expired: counts[0]?.expired || 0, soon: counts[0]?.soon || 0 }, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Full register lines: "recent-assets" (added in the period, default 30 days) or the audit snapshot. */
  private async register({ q, skip, limit, page }: any, recent: boolean) {
    let from = q.from;
    if (recent && !q.from && !q.to) from = iso(new Date(Date.now() - 30 * DAY));
    const filter = this.core.assetFilter({ ...q, from, status: q.status || (recent ? 'all' : 'active') }, { dateField: recent ? 'createdAt' : 'purchaseDate' });
    const [total, rows, rates] = await Promise.all([
      this.core.assetModel.countDocuments(filter),
      this.core.assetModel
        .find(filter)
        .select('assetCode name category brand modelNumber serialNumber location place responsiblePerson quantity unit unitPrice purchaseDate warrantyExpiry supplier condition status createdAt createdBy')
        .populate('category', 'name')
        .populate('location', 'name')
        .populate('place', 'name')
        .sort(recent ? { createdAt: -1 } : { assetCode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.core.rates(),
    ]);
    const data = rows.map((a: any) => ({ ...a, ...valuesOf(a, rates.get(String(a.category?._id))?.depreciationRate || 0) }));
    // Totals cover every matching line, not just this page.
    const all = await this.core.assetModel.find(filter).select('category quantity unitPrice purchaseDate status').lean();
    const totals = zero();
    for (const a of all) add(totals, a, valuesOf(a, rates.get(String(a.category))?.depreciationRate || 0));
    return { type: recent ? 'recent-assets' : 'audit', rows: data, totals: tidy(totals), total, page, totalPages: Math.max(1, Math.ceil(total / limit)), from };
  }
}
