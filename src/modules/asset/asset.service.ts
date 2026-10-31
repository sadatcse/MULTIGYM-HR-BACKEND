import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Asset, AssetDocument } from './schemas/asset.schema';
import { AssetAssignment, AssetAssignmentDocument } from '../asset-assignment/schemas/asset-assignment.schema';
import { AssetLocation, AssetLocationDocument } from '../asset-location/schemas/asset-location.schema';
import { Employee, EmployeeDocument } from '../user/schemas/employee.schema';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

import { AssetTransactionService } from '../asset-transaction/asset-transaction.service';

function processAssetQuantities(dto: any) {
  let sizeVariants = dto.sizeVariants || [];
  let quantityTotal = dto.quantityTotal || 1;
  let minStockThreshold = dto.minStockThreshold || 0;

  if (sizeVariants && sizeVariants.length > 0) {
    quantityTotal = sizeVariants.reduce((sum: number, v: any) => sum + (Number(v.quantityTotal) || 0), 0);
    sizeVariants = sizeVariants.map((v: any) => ({
      size: v.size || v.variantName || 'Standard',
      variantName: v.variantName || v.size,
      quantityTotal: Number(v.quantityTotal) || 0,
      quantityAvailable: Number(v.quantityTotal) || 0,
      quantityAssigned: 0,
      quantityDamaged: 0,
      quantityLost: 0,
      quantityUnderRepair: 0,
      minStockThreshold: Number(v.minStockThreshold) || 0,
    }));
  }

  const quantityAvailable = quantityTotal;
  const isLowStock = quantityAvailable <= minStockThreshold;

  const productType = (sizeVariants && sizeVariants.length > 0) || dto.productType === 'variable' ? 'variable' : 'simple';

  return {
    ...dto,
    productType,
    quantityTotal,
    quantityAvailable,
    quantityAssigned: 0,
    quantityDamaged: 0,
    quantityLost: 0,
    quantityUnderRepair: 0,
    minStockThreshold,
    isLowStock,
    sizeVariants,
    status: isLowStock && quantityAvailable === 0 ? 'low_stock' : (dto.status || 'available'),
  };
}

// "Main store (Rack B)" — how a stock location reads in the audit ledger.
const placeText = (name?: string, spot?: string) => (name ? `${name}${spot ? ` (${spot})` : ''}` : 'no location');

function withComputedQuantities(asset: any, assignedByAssetId: Map<string, number>) {
  const obj = asset.toObject ? asset.toObject() : asset;
  const quantityAssigned = assignedByAssetId.get(obj._id.toString()) || 0;
  const quantityAvailable = Math.max((obj.quantityTotal || 0) - quantityAssigned, 0);
  const isLowStock = quantityAvailable <= (obj.minStockThreshold || 0);

  return {
    ...obj,
    quantityAssigned,
    quantityAvailable,
    isLowStock,
  };
}

@Injectable()
export class AssetService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(AssetAssignment.name) private readonly assignmentModel: Model<AssetAssignmentDocument>,
    @InjectModel(AssetLocation.name) private readonly locationModel: Model<AssetLocationDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    private readonly transactionService: AssetTransactionService,
  ) {}

  // '' / null means no location; anything else must be an existing location.
  private async resolveLocation(value?: string | null) {
    if (!value) return null;
    const location = await this.locationModel.findById(value).select('name').lean();
    if (!location) throw new BadRequestException('Store location not found');
    return location;
  }

  private async actorName(id?: string) {
    if (!id || !Types.ObjectId.isValid(id)) return 'System Admin';
    const emp = await this.employeeModel.findById(id).select('name').lean();
    return emp?.name || 'System Admin';
  }

  private async getAssignedQuantityMap(assetIds: any[]): Promise<Map<string, number>> {
    if (!assetIds.length) return new Map();
    const agg = await this.assignmentModel.aggregate([
      { $match: { asset: { $in: assetIds }, status: 'active' } },
      { $group: { _id: '$asset', total: { $sum: '$quantity' } } },
    ]);
    return new Map(agg.map((a) => [a._id.toString(), a.total]));
  }

  async create(dto: CreateAssetDto) {
    const existing = await this.assetModel.findOne({
      assetCode: { $regex: new RegExp(`^${dto.assetCode.trim()}$`, 'i') },
    });
    if (existing) {
      throw new BadRequestException(`Asset code "${dto.assetCode}" already exists.`);
    }

    const location = await this.resolveLocation(dto.location);
    const payload = processAssetQuantities({ ...dto, location: location?._id ?? null, storageSpot: (dto.storageSpot || '').trim() });
    const created = await this.assetModel.create(payload);

    // Create Audit Ledger Entry
    await this.transactionService.createTransaction({
      transactionType: 'PURCHASE',
      asset: created._id as any,
      assetCode: created.assetCode,
      assetName: created.description || created.assetCode,
      size: created.size || (created.sizeVariants?.[0]?.size ?? '—'),
      quantity: created.quantityTotal,
      previousStatus: 'new',
      newStatus: created.status,
      condition: created.condition || 'New',
      performedBy: 'System Admin',
      notes: `Asset stock created with total quantity: ${created.quantityTotal}${location ? ` · stored at ${placeText(location.name, created.storageSpot)}` : ''}`,
    });

    return withComputedQuantities(created, new Map());
  }

  async findAll(query: Record<string, any>) {
    const { search, assetType, status, isLowStock, location } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { assetCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { storageSpot: { $regex: search, $options: 'i' } },
      ];
    }
    // 'none' lists assets that have no location yet.
    if (location && location !== 'all') {
      if (location !== 'none' && !Types.ObjectId.isValid(location)) throw new BadRequestException('Invalid location');
      filter.location = location === 'none' ? null : location;
    }
    if (assetType && assetType !== 'all') filter.assetType = assetType;
    if (status && status !== 'all') filter.status = status;
    if (isLowStock === 'true') filter.isLowStock = true;

    const [totalItems, data] = await Promise.all([
      this.assetModel.countDocuments(filter),
      this.assetModel
        .find(filter)
        .populate('assetType', 'name category trackingType returnable requiresSize requiresSerialNumber')
        .populate('location', 'name branch status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const assignedMap = await this.getAssignedQuantityMap(data.map((a) => a._id));

    return {
      data: data.map((a) => withComputedQuantities(a, assignedMap)),
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const result = await this.assetModel
      .findById(id)
      .populate('assetType', 'name category trackingType returnable requiresSize requiresSerialNumber replacementIntervalMonths')
      .populate({ path: 'location', select: 'name branch details inCharge status', populate: { path: 'inCharge', select: 'name employeeId mobileNumber' } });
    if (!result) {
      throw new NotFoundException('Asset not found');
    }
    const assignedMap = await this.getAssignedQuantityMap([result._id]);
    return withComputedQuantities(result, assignedMap);
  }

  async update(id: string, dto: UpdateAssetDto, actorId?: string) {
    if (dto.assetCode) {
      const existing = await this.assetModel.findOne({
        _id: { $ne: id },
        assetCode: { $regex: new RegExp(`^${dto.assetCode.trim()}$`, 'i') },
      });
      if (existing) {
        throw new BadRequestException(`Asset code "${dto.assetCode}" already exists.`);
      }
    }

    const current = await this.assetModel.findById(id);
    if (!current) {
      throw new NotFoundException('Asset not found');
    }

    const updatePayload: any = { ...dto };

    // A new location or shelf is a stock move: apply it and note it in the ledger below.
    let move: { from: string; to: string } | null = null;
    if (dto.location !== undefined || dto.storageSpot !== undefined) {
      const before = current.location ? await this.locationModel.findById(current.location).select('name').lean() : null;
      const location = dto.location !== undefined ? await this.resolveLocation(dto.location) : before;
      updatePayload.location = location?._id ?? null;
      updatePayload.storageSpot = dto.storageSpot !== undefined ? dto.storageSpot.trim() : current.storageSpot || '';
      const from = placeText(before?.name, current.storageSpot);
      const to = placeText(location?.name, updatePayload.storageSpot);
      if (from !== to) move = { from, to };
    }

    if (dto.sizeVariants && dto.sizeVariants.length > 0) {
      updatePayload.quantityTotal = dto.sizeVariants.reduce((sum, v) => sum + (Number(v.quantityTotal) || 0), 0);
      updatePayload.sizeVariants = dto.sizeVariants.map((v) => {
        const existingVar = current.sizeVariants?.find((sv) => sv.size === v.size);
        const qTotal = Number(v.quantityTotal) || 0;
        const qAssigned = existingVar ? existingVar.quantityAssigned : 0;
        const qDamaged = existingVar ? existingVar.quantityDamaged : 0;
        const qLost = existingVar ? existingVar.quantityLost : 0;
        const qRepair = existingVar ? existingVar.quantityUnderRepair : 0;
        const qAvail = Math.max(qTotal - qAssigned - qDamaged - qLost - qRepair, 0);

        return {
          size: v.size,
          quantityTotal: qTotal,
          quantityAvailable: qAvail,
          quantityAssigned: qAssigned,
          quantityDamaged: qDamaged,
          quantityLost: qLost,
          quantityUnderRepair: qRepair,
          minStockThreshold: Number(v.minStockThreshold) || 0,
        };
      });
    }

    const result = await this.assetModel.findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true });
    if (!result) {
      throw new NotFoundException('Asset not found');
    }
    const assignedMap = await this.getAssignedQuantityMap([result._id]);
    const computed = withComputedQuantities(result, assignedMap);

    if (move) {
      await this.transactionService.createTransaction({
        transactionType: 'TRANSFER',
        asset: result._id as any,
        assetCode: result.assetCode,
        assetName: result.description || result.assetCode,
        quantity: computed.quantityAvailable,
        previousStatus: result.status,
        newStatus: result.status,
        performedBy: await this.actorName(actorId),
        notes: `Stock moved from ${move.from} to ${move.to}`,
      });
    }
    return computed;
  }

  async remove(id: string) {
    const activeCount = await this.assignmentModel.countDocuments({ asset: id, status: 'active' });
    if (activeCount > 0) {
      throw new BadRequestException('Cannot delete an asset with active assignments. Return it first.');
    }
    const result = await this.assetModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Asset not found');
    }
    return { message: 'Asset deleted successfully' };
  }
}
