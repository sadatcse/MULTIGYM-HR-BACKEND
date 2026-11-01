import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Actor, actorRef, escapeRegex, GymAssetCoreService, round2, toDate, valuesOf } from './gym-asset-core.service';
import { GymAssetDisposal, GymAssetDisposalDocument, GymAssetMaintenance, GymAssetMaintenanceDocument, GymAssetTransfer, GymAssetTransferDocument } from './schemas/gym-asset-records.schema';
import { CreateDisposalDto, CreateMaintenanceDto, CreateTransferDto, UpdateDisposalDto, UpdateMaintenanceDto } from './dto/gym-asset.dto';

const isDup = (e: any) => e?.code === 11000;
const label = (s: string) => s.replace(/_/g, ' ');
const endOfDay = (v: string) => new Date(`${String(v).slice(0, 10)}T23:59:59.999Z`);
const TOMORROW = () => Date.now() + 24 * 3600 * 1000;

// Statuses a maintenance record may move to from each status.
const NEXT_STATUS: Record<string, string[]> = {
  pending: ['pending', 'in_progress', 'completed', 'cancelled'],
  in_progress: ['in_progress', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

function paged(q: Record<string, any>, max = 100) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function dateRange(field: string, q: Record<string, any>) {
  if (!q.from && !q.to) return {};
  const r: Record<string, Date> = {};
  if (q.from) r.$gte = toDate(q.from)!;
  if (q.to) r.$lte = endOfDay(q.to);
  return { [field]: r };
}

@Injectable()
export class GymAssetOpsService {
  constructor(
    private readonly core: GymAssetCoreService,
    @InjectModel(GymAssetTransfer.name) private readonly transferModel: Model<GymAssetTransferDocument>,
    @InjectModel(GymAssetMaintenance.name) private readonly maintenanceModel: Model<GymAssetMaintenanceDocument>,
    @InjectModel(GymAssetDisposal.name) private readonly disposalModel: Model<GymAssetDisposalDocument>,
  ) {}

  private assetIdFilter(q: Record<string, any>, ...fields: string[]) {
    if (!q.asset) return {};
    if (!Types.ObjectId.isValid(q.asset)) throw new BadRequestException('Invalid asset');
    const id = new Types.ObjectId(q.asset);
    return fields.length > 1 ? { $or: fields.map((f) => ({ [f]: id })) } : { [fields[0]]: id };
  }

  private search(q: Record<string, any>, idField: string) {
    if (!q.search?.trim()) return {};
    const re = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
    return { $or: [{ [idField]: re }, { assetCode: re }, { assetName: re }] };
  }

  private async openMaintenance(assetId: Types.ObjectId) {
    const open = await this.maintenanceModel.findOne({ asset: assetId, status: { $in: ['pending', 'in_progress'] } }).select('maintenanceId').lean();
    return open?.maintenanceId;
  }

  // ---------------------------------------------------------------- transfers
  async listTransfers(q: Record<string, any>) {
    const { page, limit, skip } = paged(q);
    const and: Record<string, any>[] = [this.assetIdFilter(q, 'asset', 'movedAsset'), this.search(q, 'transferId'), dateRange('transferDate', q)];
    if (q.location && q.location !== 'all') and.push({ $or: [{ 'fromLocation.id': q.location }, { 'toLocation.id': q.location }] });
    const filter = { $and: and.filter((x) => Object.keys(x).length) };
    if (!filter.$and.length) delete (filter as any).$and;
    const [total, data] = await Promise.all([
      this.transferModel.countDocuments(filter),
      this.transferModel.find(filter).sort({ transferDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** One transfer with the asset details its transfer order letter prints. */
  async findTransfer(id: string) {
    const t = Types.ObjectId.isValid(id) ? await this.transferModel.findById(id).lean() : null;
    if (!t) throw new NotFoundException('Transfer not found');
    const asset = await this.core.assetModel.findById(t.movedAsset || t.asset).select('assetCode brand modelNumber serialNumber condition').lean();
    return { ...t, assetDetails: asset };
  }

  async createTransfer(dto: CreateTransferDto, actor: Actor) {
    if (dto.requestId) {
      const existing = await this.transferModel.findOne({ requestId: dto.requestId }).lean();
      if (existing) return existing;
    }
    const to = await this.core.resolvePlace(dto.toLocation, dto.toPlace);
    const transferDate = toDate(dto.transferDate)!;
    if (transferDate.getTime() > TOMORROW()) throw new BadRequestException("Transfer date can't be in the future");
    const by = actorRef(actor);

    try {
      return await this.core.inTransaction(async (session) => {
        const asset = await this.core.activeAsset(dto.asset, session);
        const open = await this.openMaintenance(asset._id);
        if (open) throw new BadRequestException(`${asset.assetCode} has open maintenance (${open}). Complete or cancel it before transferring.`);
        if (String(asset.location) === to.location.id && String(asset.place) === to.place.id) throw new BadRequestException(`${asset.assetCode} is already in ${to.location.name} › ${to.place.name}`);
        const qty = dto.quantity ?? asset.quantity;
        if (qty > asset.quantity) throw new BadRequestException(`Only ${asset.quantity} ${asset.unit} recorded on ${asset.assetCode}`);
        if (asset.purchaseDate && transferDate < asset.purchaseDate) throw new BadRequestException("Transfer date can't be before the purchase date");

        const names = await this.core.namesOf([String(asset.location)], [String(asset.place)]);
        const from = {
          location: { id: String(asset.location), name: names.location.get(String(asset.location)) || '—' },
          place: { id: String(asset.place), name: names.place.get(String(asset.place)) || '—' },
        };
        const transferId = await this.core.nextId('TRF', session);
        const fromText = `${from.location.name} › ${from.place.name}`;
        const toText = `${to.location.name} › ${to.place.name}`;
        const category = await this.core.categoryModel.findById(asset.category).select('name').session(session).lean();
        let movedAsset: Types.ObjectId | null = null;

        if (qty === asset.quantity) {
          const r = await this.core.assetModel.updateOne(
            { _id: asset._id, status: 'active', quantity: qty },
            { $set: { location: to.location.id, place: to.place.id, updatedBy: by } },
            { session },
          );
          if (!r.modifiedCount) throw new BadRequestException('The asset changed while you were transferring it. Reload and try again.');
          await this.core.log({ asset: asset._id, assetCode: asset.assetCode, event: 'transferred', message: `Transferred ${qty} ${asset.unit} from ${fromText} to ${toText}`, ref: transferId, changes: [{ field: 'Location', from: fromText, to: toText }], by }, session);
        } else {
          // Part of a batch: the rest stays, the moved units become their own line.
          const r = await this.core.assetModel.updateOne({ _id: asset._id, status: 'active', quantity: { $gt: qty } }, { $inc: { quantity: -qty }, $set: { updatedBy: by } }, { session });
          if (!r.modifiedCount) throw new BadRequestException('The asset changed while you were transferring it. Reload and try again.');
          const assetCode = await this.core.nextId('AST', session);
          const src = asset.toObject();
          const [copy] = await this.core.assetModel.create(
            [
              {
                assetCode,
                name: src.name,
                category: src.category,
                images: src.images,
                brand: src.brand,
                modelNumber: src.modelNumber,
                serialNumber: '',
                description: src.description,
                specification: src.specification,
                quantity: qty,
                unit: src.unit,
                purchaseDate: src.purchaseDate,
                unitPrice: src.unitPrice,
                supplier: src.supplier,
                warrantyMonths: src.warrantyMonths,
                warrantyExpiry: src.warrantyExpiry,
                location: to.location.id,
                place: to.place.id,
                condition: src.condition,
                status: 'active',
                splitFrom: asset._id,
                notes: src.notes,
                createdBy: by,
                updatedBy: by,
              },
            ],
            { session },
          );
          movedAsset = copy._id;
          await this.core.log(
            [
              { asset: asset._id, assetCode: asset.assetCode, event: 'transferred', message: `Transferred ${qty} of ${asset.quantity} ${asset.unit} to ${toText}; they are now ${assetCode}. ${asset.quantity - qty} remain at ${fromText}.`, ref: transferId, changes: [{ field: 'Quantity', from: String(asset.quantity), to: String(asset.quantity - qty) }], by },
              { asset: copy._id, assetCode, event: 'split', message: `Created from ${asset.assetCode}: ${qty} ${asset.unit} moved from ${fromText} to ${toText}`, ref: transferId, by },
            ],
            session,
          );
        }

        const [transfer] = await this.transferModel.create(
          [
            {
              transferId,
              asset: asset._id,
              movedAsset,
              assetCode: asset.assetCode,
              assetName: asset.name,
              categoryName: category?.name || '',
              quantity: qty,
              unit: asset.unit,
              fromLocation: from.location,
              fromPlace: from.place,
              toLocation: to.location,
              toPlace: to.place,
              transferDate,
              reason: dto.reason.trim(),
              note: (dto.note || '').trim(),
              requestId: dto.requestId,
              by,
            },
          ],
          { session },
        );
        return transfer;
      });
    } catch (e) {
      if (isDup(e) && dto.requestId) {
        const existing = await this.transferModel.findOne({ requestId: dto.requestId }).lean();
        if (existing) return existing;
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- maintenance
  async listMaintenance(q: Record<string, any>) {
    const { page, limit, skip } = paged(q);
    const base: Record<string, any> = { ...this.assetIdFilter(q, 'asset'), ...dateRange('maintenanceDate', q), ...this.search(q, 'maintenanceId') };
    if (q.location && q.location !== 'all') base['location.id'] = q.location;
    if (q.maintenanceType && q.maintenanceType !== 'all') base.maintenanceType = q.maintenanceType;
    const filter = q.status && q.status !== 'all' ? { ...base, status: q.status } : base;
    const [total, data, byStatus] = await Promise.all([
      this.maintenanceModel.countDocuments(filter),
      this.maintenanceModel.find(filter).sort({ maintenanceDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.maintenanceModel.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 }, cost: { $sum: '$cost' } } }]),
    ]);
    const summary = { pending: 0, in_progress: 0, completed: 0, cancelled: 0, cost: 0 };
    for (const s of byStatus) {
      summary[s._id] = s.count;
      if (s._id !== 'cancelled') summary.cost += s.cost;
    }
    summary.cost = round2(summary.cost);
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary };
  }

  async createMaintenance(dto: CreateMaintenanceDto, actor: Actor) {
    if (dto.requestId) {
      const existing = await this.maintenanceModel.findOne({ requestId: dto.requestId }).lean();
      if (existing) return existing;
    }
    const maintenanceDate = toDate(dto.maintenanceDate)!;
    const next = toDate(dto.nextMaintenanceDate);
    if (next && next < maintenanceDate) throw new BadRequestException('Next maintenance date must be after the maintenance date');
    const status = dto.status || 'pending';
    const by = actorRef(actor);

    try {
      return await this.core.inTransaction(async (session) => {
        const asset = await this.core.activeAsset(dto.asset, session);
        const open = await this.openMaintenance(asset._id);
        if (open) throw new BadRequestException(`${asset.assetCode} already has open maintenance (${open}). Update that record instead.`);
        const names = await this.core.namesOf([String(asset.location)], [String(asset.place)]);
        const maintenanceId = await this.core.nextId('MNT', session);
        const [record] = await this.maintenanceModel.create(
          [
            {
              maintenanceId,
              asset: asset._id,
              assetCode: asset.assetCode,
              assetName: asset.name,
              location: { id: String(asset.location), name: names.location.get(String(asset.location)) || '—' },
              place: { id: String(asset.place), name: names.place.get(String(asset.place)) || '—' },
              problem: dto.problem.trim(),
              maintenanceType: dto.maintenanceType,
              serviceProvider: (dto.serviceProvider || '').trim(),
              technician: (dto.technician || '').trim(),
              maintenanceDate,
              cost: dto.cost || 0,
              nextMaintenanceDate: next,
              status,
              attachments: dto.attachments || [],
              remarks: (dto.remarks || '').trim(),
              conditionBefore: asset.condition,
              requestId: dto.requestId,
              by,
            },
          ],
          { session },
        );
        if (status === 'in_progress') {
          await this.core.assetModel.updateOne({ _id: asset._id }, { $set: { condition: 'under_maintenance', updatedBy: by } }, { session });
          await this.core.log({ asset: asset._id, assetCode: asset.assetCode, event: 'maintenance_started', message: `Maintenance started (${label(dto.maintenanceType)}): ${dto.problem.trim()}`, ref: maintenanceId, changes: [{ field: 'Condition', from: asset.condition, to: 'under_maintenance' }], by }, session);
        } else {
          await this.core.log({ asset: asset._id, assetCode: asset.assetCode, event: 'maintenance_logged', message: `Maintenance logged (${label(dto.maintenanceType)}), waiting to start: ${dto.problem.trim()}`, ref: maintenanceId, by }, session);
        }
        return record;
      });
    } catch (e) {
      if (isDup(e) && dto.requestId) {
        const existing = await this.maintenanceModel.findOne({ requestId: dto.requestId }).lean();
        if (existing) return existing;
      }
      throw e;
    }
  }

  async updateMaintenance(id: string, dto: UpdateMaintenanceDto, actor: Actor) {
    const record = Types.ObjectId.isValid(id) ? await this.maintenanceModel.findById(id) : null;
    if (!record) throw new NotFoundException('Maintenance record not found');
    const closed = ['completed', 'cancelled'].includes(record.status);
    const status = dto.status || record.status;
    if (!NEXT_STATUS[record.status].includes(status)) throw new BadRequestException(`A ${label(record.status)} record can't be moved to ${label(status)}`);
    if (closed) {
      const locked = (['problem', 'maintenanceType', 'serviceProvider', 'technician', 'maintenanceDate', 'completionDate', 'conditionAfter'] as const).filter((k) => dto[k] !== undefined && String(dto[k]) !== String((record as any)[k] ?? ''));
      if (locked.length) throw new BadRequestException(`This record is ${label(record.status)}. Only cost, invoice, next maintenance date and remarks can still change.`);
    }

    const maintenanceDate = dto.maintenanceDate ? toDate(dto.maintenanceDate)! : record.maintenanceDate;
    const next = dto.nextMaintenanceDate !== undefined ? toDate(dto.nextMaintenanceDate) : record.nextMaintenanceDate;
    if (next && next < maintenanceDate) throw new BadRequestException('Next maintenance date must be after the maintenance date');

    for (const k of ['problem', 'maintenanceType', 'serviceProvider', 'technician', 'remarks'] as const) {
      if (dto[k] !== undefined) (record as any)[k] = String(dto[k]).trim();
    }
    if (!record.problem) throw new BadRequestException('Describe the problem');
    record.maintenanceDate = maintenanceDate;
    record.nextMaintenanceDate = next;
    if (dto.cost !== undefined) record.cost = dto.cost;
    if (dto.attachments !== undefined) record.attachments = dto.attachments as any;

    const by = actorRef(actor);
    const changing = status !== record.status;
    const entries: any[] = [];
    let condition: string | undefined;

    if (changing) {
      const asset = await this.core.activeAsset(String(record.asset));
      const base = { asset: asset._id, assetCode: asset.assetCode, ref: record.maintenanceId, by };
      if (status === 'in_progress') {
        condition = 'under_maintenance';
        entries.push({ ...base, event: 'maintenance_started', message: `Maintenance started (${label(record.maintenanceType)}): ${record.problem}`, changes: [{ field: 'Condition', from: asset.condition, to: condition }] });
      } else if (status === 'completed') {
        const done = dto.completionDate ? toDate(dto.completionDate)! : undefined;
        if (!done) throw new BadRequestException('Enter the completion date');
        if (done < maintenanceDate) throw new BadRequestException("Completion date can't be before the maintenance date");
        if (done.getTime() > TOMORROW()) throw new BadRequestException("Completion date can't be in the future");
        record.completionDate = done;
        const fallback = ['damaged', 'non_functional', 'under_maintenance'].includes(record.conditionBefore) ? 'good' : record.conditionBefore;
        condition = dto.conditionAfter || fallback;
        record.conditionAfter = condition;
        entries.push({ ...base, event: 'maintenance_completed', message: `Maintenance completed${record.cost ? `, cost ${record.cost}` : ''}. Condition is now ${label(condition)}.`, changes: [{ field: 'Condition', from: asset.condition, to: condition }] });
      } else if (status === 'cancelled') {
        // Put the condition back only if this record had changed it.
        if (asset.condition === 'under_maintenance') condition = record.conditionBefore;
        entries.push({ ...base, event: 'maintenance_cancelled', message: `Maintenance cancelled${condition ? `; condition back to ${label(condition)}` : ''}`, changes: condition ? [{ field: 'Condition', from: asset.condition, to: condition }] : [] });
      }
      record.status = status;
    }

    await this.core.inTransaction(async (session) => {
      await record.save({ session });
      if (condition) await this.core.assetModel.updateOne({ _id: record.asset, status: 'active' }, { $set: { condition, updatedBy: by } }, { session });
      if (entries.length) await this.core.log(entries, session);
    });
    return record;
  }

  // ---------------------------------------------------------------- disposals
  async listDisposals(q: Record<string, any>) {
    const { page, limit, skip } = paged(q);
    const filter: Record<string, any> = { ...this.assetIdFilter(q, 'asset'), ...dateRange('disposalDate', q), ...this.search(q, 'disposalId') };
    if (q.location && q.location !== 'all') filter['location.id'] = q.location;
    if (q.disposalType && q.disposalType !== 'all') filter.disposalType = q.disposalType;
    const [total, data, sums] = await Promise.all([
      this.disposalModel.countDocuments(filter),
      this.disposalModel.find(filter).sort({ disposalDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.disposalModel.aggregate([{ $match: filter }, { $group: { _id: null, bookValue: { $sum: '$bookValue' }, disposalValue: { $sum: '$disposalValue' } } }]),
    ]);
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary: { bookValue: round2(sums[0]?.bookValue || 0), disposalValue: round2(sums[0]?.disposalValue || 0) } };
  }

  async createDisposal(dto: CreateDisposalDto, actor: Actor) {
    if (dto.requestId) {
      const existing = await this.disposalModel.findOne({ requestId: dto.requestId }).lean();
      if (existing) return existing;
    }
    const disposalDate = toDate(dto.disposalDate)!;
    if (disposalDate.getTime() > TOMORROW()) throw new BadRequestException("Disposal date can't be in the future");
    const approvedBy = { id: '', name: dto.approvedByName.trim() };
    const by = actorRef(actor);

    try {
      return await this.core.inTransaction(async (session) => {
        const asset = await this.core.activeAsset(dto.asset, session);
        const open = await this.openMaintenance(asset._id);
        if (open) throw new BadRequestException(`${asset.assetCode} has open maintenance (${open}). Complete or cancel it first.`);
        if (asset.purchaseDate && disposalDate < asset.purchaseDate) throw new BadRequestException("Disposal date can't be before the purchase date");
        const [names, category] = await Promise.all([
          this.core.namesOf([String(asset.location)], [String(asset.place)]),
          this.core.categoryModel.findById(asset.category).select('name depreciationRate').session(session).lean(),
        ]);
        const disposalId = await this.core.nextId('DSP', session);
        const [record] = await this.disposalModel.create(
          [
            {
              disposalId,
              asset: asset._id,
              assetCode: asset.assetCode,
              assetName: asset.name,
              categoryName: category?.name || '',
              quantity: asset.quantity,
              location: { id: String(asset.location), name: names.location.get(String(asset.location)) || '—' },
              place: { id: String(asset.place), name: names.place.get(String(asset.place)) || '—' },
              bookValue: valuesOf(asset, category?.depreciationRate || 0, disposalDate).currentValue,
              disposalDate,
              reason: dto.reason.trim(),
              disposalType: dto.disposalType,
              disposalValue: dto.disposalValue || 0,
              approvedBy,
              attachments: dto.attachments || [],
              remarks: (dto.remarks || '').trim(),
              requestId: dto.requestId,
              by,
            },
          ],
          { session },
        );
        const r = await this.core.assetModel.updateOne({ _id: asset._id, status: 'active' }, { $set: { status: 'disposed', condition: 'disposed', updatedBy: by } }, { session });
        if (!r.modifiedCount) throw new BadRequestException('The asset changed while you were disposing of it. Reload and try again.');
        await this.core.log({ asset: asset._id, assetCode: asset.assetCode, event: 'disposed', message: `Disposed (${label(dto.disposalType)}): ${dto.reason.trim()}. Approved by ${approvedBy.name}.`, ref: disposalId, changes: [{ field: 'Status', from: 'active', to: 'disposed' }], by }, session);
        return record;
      });
    } catch (e) {
      if (isDup(e) && dto.requestId) {
        const existing = await this.disposalModel.findOne({ requestId: dto.requestId }).lean();
        if (existing) return existing;
      }
      throw e;
    }
  }

  /** The disposal itself is final; documents and remarks can be added later. */
  async updateDisposal(id: string, dto: UpdateDisposalDto) {
    const record = Types.ObjectId.isValid(id) ? await this.disposalModel.findById(id) : null;
    if (!record) throw new NotFoundException('Disposal record not found');
    if (dto.attachments !== undefined) record.attachments = dto.attachments as any;
    if (dto.remarks !== undefined) record.remarks = dto.remarks.trim();
    return record.save();
  }
}
