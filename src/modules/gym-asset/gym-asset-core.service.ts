import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { GymAssetLocation, GymAssetLocationDocument } from './schemas/gym-asset-location.schema';
import { GymAsset, GymAssetDocument } from './schemas/gym-asset.schema';
import { GymAssetPlace, GymAssetPlaceDocument } from './schemas/gym-asset-place.schema';
import { GymAssetCategory, GymAssetCategoryDocument } from './schemas/gym-asset-category.schema';
import { GymAssetCounter, GymAssetCounterDocument, GymAssetHistory, GymAssetHistoryDocument } from './schemas/gym-asset-records.schema';
import { ActorRef } from './schemas/gym-asset-common';

export type Actor = { id: string; name: string };
export const actorRef = (a: Actor): ActorRef => ({ id: String(a?.id || ''), name: a?.name || '' });

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

// Straight-line depreciation: the line's purchase value less `rate`% per year
// since purchase, never below zero. Disposed lines are worth nothing on the books.
export function valuesOf(a: { unitPrice?: number; quantity?: number; purchaseDate?: Date | null; status?: string }, rate = 0, at = new Date()) {
  const purchaseValue = round2((a.unitPrice || 0) * (a.quantity || 0));
  if (a.status === 'disposed') return { purchaseValue, currentValue: 0 };
  if (!rate || !a.purchaseDate) return { purchaseValue, currentValue: purchaseValue };
  const years = Math.max(0, (at.getTime() - new Date(a.purchaseDate).getTime()) / YEAR_MS);
  return { purchaseValue, currentValue: round2(Math.max(0, purchaseValue * (1 - (rate / 100) * years))) };
}

/** Parses a YYYY-MM-DD (or ISO) string to a Date; '' / undefined → undefined. */
export const toDate = (v?: string | null) => (v ? new Date(String(v).length === 10 ? `${v}T00:00:00.000Z` : v) : undefined);

export type HistoryEntry = {
  asset: Types.ObjectId | string;
  assetCode: string;
  event: string;
  message: string;
  changes?: Array<{ field: string; from: string; to: string }>;
  ref?: string;
  by: ActorRef;
};

@Injectable()
export class GymAssetCoreService {
  constructor(
    @InjectConnection() readonly connection: Connection,
    @InjectModel(GymAsset.name) readonly assetModel: Model<GymAssetDocument>,
    @InjectModel(GymAssetPlace.name) readonly placeModel: Model<GymAssetPlaceDocument>,
    @InjectModel(GymAssetCategory.name) readonly categoryModel: Model<GymAssetCategoryDocument>,
    @InjectModel(GymAssetLocation.name) readonly locationModel: Model<GymAssetLocationDocument>,
    @InjectModel(GymAssetHistory.name) readonly historyModel: Model<GymAssetHistoryDocument>,
    @InjectModel(GymAssetCounter.name) private readonly counterModel: Model<GymAssetCounterDocument>,
  ) {}

  /** Next human-readable number for a prefix: AST-00001, TRF-00001, … */
  async nextId(prefix: string, session?: ClientSession) {
    const c = await this.counterModel.findOneAndUpdate({ key: prefix }, { $inc: { seq: 1 } }, { upsert: true, new: true, session });
    return `${prefix}-${String(c.seq).padStart(5, '0')}`;
  }

  async log(entries: HistoryEntry | HistoryEntry[], session?: ClientSession) {
    const list = [entries].flat();
    if (list.length) await this.historyModel.insertMany(list, { session });
  }

  /** Runs `work` in a transaction so multi-document changes land together or not at all. */
  async inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Checks that `placeId` is a place inside `locationId`. For anything new
   * (a new asset, a transfer destination) both must also be active.
   */
  async resolvePlace(locationId: string, placeId: string, { requireActive = true } = {}) {
    if (!Types.ObjectId.isValid(locationId)) throw new BadRequestException('Pick a valid location');
    if (!Types.ObjectId.isValid(placeId)) throw new BadRequestException('Pick a valid place');
    const [location, place] = await Promise.all([
      this.locationModel.findById(locationId).select('name status').lean(),
      this.placeModel.findById(placeId).select('name status location').lean(),
    ]);
    if (!location) throw new BadRequestException('That location no longer exists');
    if (!place) throw new BadRequestException('That place no longer exists');
    if (String(place.location) !== String(location._id)) throw new BadRequestException(`"${place.name}" is not a place in ${location.name}`);
    if (requireActive && location.status !== 'active') throw new BadRequestException(`${location.name} is inactive`);
    if (requireActive && place.status !== 'active') throw new BadRequestException(`${place.name} is inactive`);
    return { location: { id: String(location._id), name: location.name }, place: { id: String(place._id), name: place.name } };
  }

  async resolveCategory(categoryId: string, { requireActive = true } = {}) {
    const category = Types.ObjectId.isValid(categoryId) ? await this.categoryModel.findById(categoryId).select('name status depreciationRate').lean() : null;
    if (!category) throw new BadRequestException('That category no longer exists');
    if (requireActive && category.status !== 'active') throw new BadRequestException(`The "${category.name}" category is inactive`);
    return category;
  }

  /** An asset that can still be changed: exists and is not disposed. */
  async activeAsset(id: string, session?: ClientSession) {
    const asset = Types.ObjectId.isValid(id) ? await this.assetModel.findById(id).session(session || null) : null;
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === 'disposed') throw new BadRequestException(`${asset.assetCode} is disposed and archived; it can't be changed`);
    return asset;
  }

  /** Names for a set of location / place ids, for snapshots and messages. */
  async namesOf(locationIds: string[], placeIds: string[]) {
    const [locations, places] = await Promise.all([
      this.locationModel.find({ _id: { $in: locationIds.filter(Boolean) } }).select('name').lean(),
      this.placeModel.find({ _id: { $in: placeIds.filter(Boolean) } }).select('name').lean(),
    ]);
    return {
      location: new Map(locations.map((l) => [String(l._id), l.name])),
      place: new Map(places.map((p) => [String(p._id), p.name])),
    };
  }

  /** Depreciation rate per category id. */
  async rates() {
    const cats = await this.categoryModel.find().select('depreciationRate name').lean();
    return new Map(cats.map((c) => [String(c._id), c]));
  }

  /**
   * Mongo filter for the register and reports. `status` defaults to active
   * lines; 'all' includes disposed ones.
   */
  assetFilter(q: Record<string, any>, { dateField }: { dateField?: string } = {}) {
    const filter: Record<string, any> = {};
    const status = q.status || 'active';
    if (status !== 'all') filter.status = status;
    for (const key of ['location', 'place', 'category'] as const) {
      if (!q[key] || q[key] === 'all') continue;
      if (!Types.ObjectId.isValid(q[key])) throw new BadRequestException(`Invalid ${key}`);
      filter[key] = new Types.ObjectId(q[key]);
    }
    if (q.condition && q.condition !== 'all') filter.condition = q.condition;
    if (q.person && q.person !== 'all') filter.responsiblePerson = { $regex: `^${escapeRegex(String(q.person).trim())}$`, $options: 'i' };
    if (q.search?.trim()) {
      const re = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
      filter.$or = [{ assetCode: re }, { name: re }, { serialNumber: re }, { brand: re }, { modelNumber: re }, { supplier: re }, { responsiblePerson: re }];
    }
    if (dateField && (q.from || q.to)) {
      filter[dateField] = {};
      if (q.from) filter[dateField].$gte = toDate(q.from);
      if (q.to) filter[dateField].$lte = new Date(`${String(q.to).slice(0, 10)}T23:59:59.999Z`);
    }
    return filter;
  }
}
