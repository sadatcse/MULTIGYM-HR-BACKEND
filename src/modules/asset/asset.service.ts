import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset, AssetDocument } from './schemas/asset.schema';
import { AssetAssignment, AssetAssignmentDocument } from '../asset-assignment/schemas/asset-assignment.schema';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

function withComputedQuantities(asset: any, assignedByAssetId: Map<string, number>) {
  const obj = asset.toObject ? asset.toObject() : asset;
  const quantityAssigned = assignedByAssetId.get(obj._id.toString()) || 0;
  return {
    ...obj,
    quantityAssigned,
    quantityAvailable: Math.max(obj.quantityTotal - quantityAssigned, 0),
  };
}

@Injectable()
export class AssetService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(AssetAssignment.name) private readonly assignmentModel: Model<AssetAssignmentDocument>,
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
    const created = await this.assetModel.create(dto);
    return withComputedQuantities(created, new Map());
  }

  async findAll(query: Record<string, any>) {
    const { search, assetType, status } = query;
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

    const [totalItems, data] = await Promise.all([
      this.assetModel.countDocuments(filter),
      this.assetModel.find(filter).populate('assetType', 'name category trackingType returnable').sort({ createdAt: -1 }).skip(skip).limit(limit),
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
    const result = await this.assetModel.findById(id).populate('assetType', 'name category trackingType returnable replacementIntervalMonths');
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
    const result = await this.assetModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
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
