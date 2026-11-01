import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Actor, actorRef, GymAssetCoreService, HistoryEntry, toDate, valuesOf } from './gym-asset-core.service';
import { GymAssetDisposal, GymAssetDisposalDocument, GymAssetMaintenance, GymAssetMaintenanceDocument, GymAssetTransfer, GymAssetTransferDocument } from './schemas/gym-asset-records.schema';
import { CreateGymAssetDto, UpdateGymAssetDto } from './dto/gym-asset.dto';

const LIST_FIELDS = 'assetCode name category location place responsiblePerson quantity unit unitPrice purchaseDate warrantyExpiry condition status brand modelNumber serialNumber supplier createdAt';
const day = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const isDup = (e: any) => e?.code === 11000;

@Injectable()
export class GymAssetService {
  constructor(
    private readonly core: GymAssetCoreService,
    @InjectModel(GymAssetTransfer.name) private readonly transferModel: Model<GymAssetTransferDocument>,
    @InjectModel(GymAssetMaintenance.name) private readonly maintenanceModel: Model<GymAssetMaintenanceDocument>,
    @InjectModel(GymAssetDisposal.name) private readonly disposalModel: Model<GymAssetDisposalDocument>,
  ) {}

  private populateList<T>(query: T): T {
    return (query as any)
      .populate('category', 'name depreciationRate')
      .populate('location', 'name')
      .populate('place', 'name');
  }

  private withValues(a: any) {
    return { ...a, ...valuesOf(a, a.category?.depreciationRate || 0) };
  }

  // ---------------------------------------------------------------- reads
  async list(q: Record<string, any>) {
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
    const filter = this.core.assetFilter(q, { dateField: 'purchaseDate' });
    const sort: Record<string, 1 | -1> = q.sort === 'code' ? { assetCode: 1 } : q.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const [total, rows] = await Promise.all([
      this.core.assetModel.countDocuments(filter),
      this.populateList(this.core.assetModel.find(filter).select(`${LIST_FIELDS} images`).slice('images', 1).sort(sort).skip((page - 1) * limit).limit(limit)).lean(),
    ]);
    return { data: rows.map((a) => this.withValues(a)), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Header figures for the register, over the same filters as the list. */
  async stats(q: Record<string, any>) {
    const filter = this.core.assetFilter(q, { dateField: 'purchaseDate' });
    const [rows, rates] = await Promise.all([
      this.core.assetModel.find(filter).select('category quantity unitPrice purchaseDate condition status warrantyExpiry').lean(),
      this.core.rates(),
    ]);
    const soon = Date.now() + 30 * 24 * 3600 * 1000;
    const s = { lines: 0, units: 0, purchaseValue: 0, currentValue: 0, damaged: 0, underMaintenance: 0, warrantySoon: 0 };
    for (const a of rows) {
      const v = valuesOf(a, rates.get(String(a.category))?.depreciationRate || 0);
      s.lines += 1;
      s.units += a.quantity || 0;
      s.purchaseValue += v.purchaseValue;
      s.currentValue += v.currentValue;
      if (['damaged', 'non_functional'].includes(a.condition)) s.damaged += 1;
      if (a.condition === 'under_maintenance') s.underMaintenance += 1;
      const w = a.warrantyExpiry ? new Date(a.warrantyExpiry).getTime() : 0;
      if (a.status === 'active' && w && w >= Date.now() && w <= soon) s.warrantySoon += 1;
    }
    s.purchaseValue = Math.round(s.purchaseValue * 100) / 100;
    s.currentValue = Math.round(s.currentValue * 100) / 100;
    return s;
  }

  /** Small search result for asset pickers (transfer, maintenance, disposal). */
  async options(q: Record<string, any>) {
    const filter = this.core.assetFilter({ ...q, status: 'active' });
    const rows = await this.core.assetModel
      .find(filter)
      .select('assetCode name quantity unit condition location place')
      .populate('location', 'name')
      .populate('place', 'name')
      .sort({ assetCode: 1 })
      .limit(Math.min(30, parseInt(q.limit, 10) || 20))
      .lean();
    return rows;
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Asset not found');
    const asset: any = await this.core.assetModel
      .findById(id)
      .populate('category', 'name depreciationRate status')
      .populate('location', 'name type address contactPerson contactNumber status')
      .populate('place', 'name status')
      .populate('splitFrom', 'assetCode name')
      .lean();
    if (!asset) throw new NotFoundException('Asset not found');
    const [openMaintenance, disposal, transfers, maintenance] = await Promise.all([
      this.maintenanceModel.findOne({ asset: asset._id, status: { $in: ['pending', 'in_progress'] } }).lean(),
      asset.status === 'disposed' ? this.disposalModel.findOne({ asset: asset._id }).lean() : null,
      this.transferModel.countDocuments({ $or: [{ asset: asset._id }, { movedAsset: asset._id }] }),
      this.maintenanceModel.countDocuments({ asset: asset._id }),
    ]);
    return { ...this.withValues(asset), openMaintenance, disposal, counts: { transfers, maintenance } };
  }

  async history(id: string, q: Record<string, any>) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Asset not found');
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 30));
    const [total, data] = await Promise.all([
      this.core.historyModel.countDocuments({ asset: id }),
      this.core.historyModel.find({ asset: id }).sort({ at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // ---------------------------------------------------------------- writes
  /** Purchase / warranty dates: fills the expiry from the warranty length and checks the order. */
  private dates(purchase?: Date, months?: number, expiry?: Date) {
    const now = Date.now() + 24 * 3600 * 1000;
    if (purchase && purchase.getTime() > now) throw new BadRequestException("Purchase date can't be in the future");
    if (!expiry && purchase && months) {
      expiry = new Date(purchase);
      expiry.setUTCMonth(expiry.getUTCMonth() + months);
    }
    if (purchase && expiry && expiry < purchase) throw new BadRequestException('Warranty expiry must be after the purchase date');
    return expiry;
  }

  async create(dto: CreateGymAssetDto, actor: Actor) {
    if (dto.requestId) {
      const existing = await this.core.assetModel.findOne({ requestId: dto.requestId }).lean();
      if (existing) return existing;
    }
    await this.core.resolveCategory(dto.category);
    const where = await this.core.resolvePlace(dto.location, dto.place);
    const purchaseDate = toDate(dto.purchaseDate);
    const warrantyExpiry = this.dates(purchaseDate, dto.warrantyMonths, toDate(dto.warrantyExpiry));
    const by = actorRef(actor);

    try {
      return await this.core.inTransaction(async (session) => {
        const assetCode = await this.core.nextId('AST', session);
        const [asset] = await this.core.assetModel.create(
          [
            {
              ...dto,
              assetCode,
              name: dto.name.trim(),
              responsiblePerson: (dto.responsiblePerson || '').trim(),
              purchaseDate,
              warrantyExpiry,
              unit: (dto.unit || 'pcs').trim() || 'pcs',
              condition: dto.condition || 'new',
              status: 'active',
              createdBy: by,
              updatedBy: by,
            },
          ],
          { session },
        );
        await this.core.log(
          {
            asset: asset._id,
            assetCode,
            event: 'created',
            message: `Added to the register: ${asset.quantity} ${asset.unit} at ${where.location.name} › ${where.place.name}`,
            by,
          },
          session,
        );
        return asset;
      });
    } catch (e) {
      // Two copies of the same retried request raced; hand back the one that won.
      if (isDup(e) && dto.requestId) {
        const existing = await this.core.assetModel.findOne({ requestId: dto.requestId }).lean();
        if (existing) return existing;
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateGymAssetDto, actor: Actor) {
    const asset = await this.core.activeAsset(id);
    const by = actorRef(actor);
    const entries: HistoryEntry[] = [];
    const base = { asset: asset._id, assetCode: asset.assetCode, by };
    const changes: Array<{ field: string; from: string; to: string }> = [];
    const set: Record<string, any> = {};

    // Plain fields: record from → to for the "updated" entry.
    const plain: Array<[keyof UpdateGymAssetDto, string]> = [
      ['name', 'Name'],
      ['brand', 'Brand'],
      ['modelNumber', 'Model'],
      ['serialNumber', 'Serial number'],
      ['description', 'Description'],
      ['specification', 'Specification'],
      ['quantity', 'Quantity'],
      ['unit', 'Unit'],
      ['unitPrice', 'Purchase price (per unit)'],
      ['supplier', 'Supplier'],
      ['responsiblePerson', 'Responsible person'],
      ['warrantyMonths', 'Warranty (months)'],
      ['notes', 'Notes'],
    ];
    for (const [key, label] of plain) {
      if (dto[key] === undefined) continue;
      const next = typeof dto[key] === 'string' ? String(dto[key]).trim() : dto[key];
      if (String(next ?? '') === String((asset as any)[key] ?? '')) continue;
      if (key === 'name' && !next) throw new BadRequestException('Asset name is required');
      changes.push({ field: label, from: String((asset as any)[key] ?? ''), to: String(next ?? '') });
      set[key] = next;
    }

    if (dto.images !== undefined) {
      const before = (asset.images || []).map((f) => f.url).join('|');
      if (before !== dto.images.map((f) => f.url).join('|')) {
        changes.push({ field: 'Images', from: `${asset.images.length}`, to: `${dto.images.length}` });
        set.images = dto.images;
      }
    }

    const purchaseDate = dto.purchaseDate !== undefined ? toDate(dto.purchaseDate) : asset.purchaseDate;
    const months = dto.warrantyMonths !== undefined ? dto.warrantyMonths : asset.warrantyMonths;
    const expiryIn = dto.warrantyExpiry !== undefined ? toDate(dto.warrantyExpiry) : dto.warrantyMonths !== undefined || dto.purchaseDate !== undefined ? undefined : asset.warrantyExpiry;
    const warrantyExpiry = this.dates(purchaseDate || undefined, months, expiryIn || undefined);
    if (day(purchaseDate) !== day(asset.purchaseDate)) {
      changes.push({ field: 'Purchase date', from: day(asset.purchaseDate), to: day(purchaseDate) });
      set.purchaseDate = purchaseDate || null;
    }
    if (day(warrantyExpiry) !== day(asset.warrantyExpiry)) {
      changes.push({ field: 'Warranty expiry', from: day(asset.warrantyExpiry), to: day(warrantyExpiry) });
      set.warrantyExpiry = warrantyExpiry || null;
    }

    if (dto.category && dto.category !== String(asset.category)) {
      const [before, after] = await Promise.all([this.core.resolveCategory(String(asset.category), { requireActive: false }).catch(() => null), this.core.resolveCategory(dto.category)]);
      set.category = after._id;
      entries.push({ ...base, event: 'category_changed', message: `Category changed from ${before?.name || '—'} to ${after.name}`, changes: [{ field: 'Category', from: before?.name || '', to: after.name }] });
    }

    const locationId = dto.location || String(asset.location);
    const placeId = dto.place || String(asset.place);
    if (locationId !== String(asset.location) || placeId !== String(asset.place)) {
      const where = await this.core.resolvePlace(locationId, placeId);
      const names = await this.core.namesOf([String(asset.location)], [String(asset.place)]);
      const fromLoc = names.location.get(String(asset.location)) || '—';
      const fromPlace = names.place.get(String(asset.place)) || '—';
      set.location = where.location.id;
      set.place = where.place.id;
      if (locationId !== String(asset.location)) {
        entries.push({ ...base, event: 'location_changed', message: `Location changed from ${fromLoc} › ${fromPlace} to ${where.location.name} › ${where.place.name}`, changes: [{ field: 'Location', from: fromLoc, to: where.location.name }, { field: 'Place', from: fromPlace, to: where.place.name }] });
      } else {
        entries.push({ ...base, event: 'place_changed', message: `Moved within ${where.location.name} from ${fromPlace} to ${where.place.name}`, changes: [{ field: 'Place', from: fromPlace, to: where.place.name }] });
      }
    }

    if (dto.condition && dto.condition !== asset.condition) {
      const open = await this.maintenanceModel.exists({ asset: asset._id, status: { $in: ['pending', 'in_progress'] } });
      if (open) throw new BadRequestException('This asset has open maintenance. Its condition is set when the maintenance is completed or cancelled.');
      if (dto.condition === 'under_maintenance') throw new BadRequestException('To put an asset under maintenance, log a maintenance record for it');
      set.condition = dto.condition;
      entries.push({ ...base, event: 'condition_changed', message: `Condition changed from ${asset.condition.replace(/_/g, ' ')} to ${dto.condition.replace(/_/g, ' ')}`, changes: [{ field: 'Condition', from: asset.condition, to: dto.condition }] });
    }

    if (changes.length) entries.push({ ...base, event: 'updated', message: `Updated ${changes.map((c) => c.field.toLowerCase()).join(', ')}`, changes });
    if (!entries.length) return this.findOne(id);

    set.updatedBy = by;
    await this.core.inTransaction(async (session) => {
      await this.core.assetModel.updateOne({ _id: asset._id, status: 'active' }, { $set: set }, { session, runValidators: true });
      await this.core.log(entries, session);
    });
    return this.findOne(id);
  }

  /** Only for lines entered by mistake: anything with transfers, maintenance or a disposal stays. */
  async remove(id: string, actor: Actor) {
    const asset = Types.ObjectId.isValid(id) ? await this.core.assetModel.findById(id).lean() : null;
    if (!asset) throw new NotFoundException('Asset not found');
    const [transfers, maintenance, disposal] = await Promise.all([
      this.transferModel.countDocuments({ $or: [{ asset: asset._id }, { movedAsset: asset._id }] }),
      this.maintenanceModel.countDocuments({ asset: asset._id }),
      this.disposalModel.countDocuments({ asset: asset._id }),
    ]);
    if (transfers || maintenance || disposal) {
      throw new BadRequestException(`${asset.assetCode} has transfer, maintenance or disposal records, so it can't be deleted. Dispose of it instead.`);
    }
    await this.core.inTransaction(async (session) => {
      await this.core.assetModel.deleteOne({ _id: asset._id }, { session });
      // The history stays as the record that the line existed and who removed it.
      await this.core.log({ asset: asset._id, assetCode: asset.assetCode, event: 'deleted', message: `${asset.assetCode} (${asset.name}) was deleted from the register`, by: actorRef(actor) }, session);
    });
    return { message: `${asset.assetCode} deleted` };
  }
}
