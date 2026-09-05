import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset, AssetDocument } from './schemas/asset.schema';
import { AssetAssignment, AssetAssignmentDocument } from '../asset-assignment/schemas/asset-assignment.schema';
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
    private readonly transactionService: AssetTransactionService,
  ) {}

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

    const payload = processAssetQuantities(dto);
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
      notes: `Asset stock created with total quantity: ${created.quantityTotal}`,
    });

    return withComputedQuantities(created, new Map());
  }

  async findAll(query: Record<string, any>) {
    const { search, assetType, status, isLowStock } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { assetCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (assetType && assetType !== 'all') filter.assetType = assetType;
    if (status && status !== 'all') filter.status = status;
    if (isLowStock === 'true') filter.isLowStock = true;

    const [totalItems, data] = await Promise.all([
      this.assetModel.countDocuments(filter),
      this.assetModel.find(filter).populate('assetType', 'name category trackingType returnable requiresSize requiresSerialNumber').sort({ createdAt: -1 }).skip(skip).limit(limit),
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
    const result = await this.assetModel.findById(id).populate('assetType', 'name category trackingType returnable requiresSize requiresSerialNumber replacementIntervalMonths');
    if (!result) {
      throw new NotFoundException('Asset not found');
    }
    const assignedMap = await this.getAssignedQuantityMap([result._id]);
    return withComputedQuantities(result, assignedMap);
  }

  async update(id: string, dto: UpdateAssetDto) {
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
    return withComputedQuantities(result, assignedMap);
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
