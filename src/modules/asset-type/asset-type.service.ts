import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssetType, AssetTypeDocument } from './schemas/asset-type.schema';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';

@Injectable()
export class AssetTypeService {
  constructor(
    @InjectModel(AssetType.name) private readonly assetTypeModel: Model<AssetTypeDocument>,
  ) {}

  async create(createDto: CreateAssetTypeDto) {
    const { name, order } = createDto;

    const existingName = await this.assetTypeModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Asset type "${name}" already exists.`);
    }

    const existingOrder = await this.assetTypeModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const created = new this.assetTypeModel(createDto);
    return created.save();
  }

  async findAll(search?: string, status?: string, category?: string, page?: number, limit?: number) {
    const filter: any = {};
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }

    const total = await this.assetTypeModel.countDocuments(filter);

    let query = this.assetTypeModel.find(filter).sort({ order: 1, createdAt: -1 });
    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    const totalPages = limit ? Math.ceil(total / limit) || 1 : 1;

    const totalAssetTypes = await this.assetTypeModel.countDocuments();
    const activeAssetTypes = await this.assetTypeModel.countDocuments({ status: 'active' });
    const inactiveAssetTypes = await this.assetTypeModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.assetTypeModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      stats: { totalAssetTypes, activeAssetTypes, inactiveAssetTypes, maxDisplayOrder },
    };
  }

  async findOne(id: string) {
    const assetType = await this.assetTypeModel.findById(id);
    if (!assetType) {
      throw new NotFoundException('Asset type not found');
    }
    return assetType;
  }

  async update(id: string, updateDto: UpdateAssetTypeDto) {
    const assetType = await this.assetTypeModel.findById(id);
    if (!assetType) {
      throw new NotFoundException('Asset type not found');
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== assetType.name.toLowerCase()) {
      const existingName = await this.assetTypeModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Asset type "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== assetType.order) {
      const existingOrder = await this.assetTypeModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    return this.assetTypeModel.findByIdAndUpdate(id, updateDto, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const result = await this.assetTypeModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Asset type not found');
    }
    return { message: 'Asset type deleted successfully' };
  }
}
