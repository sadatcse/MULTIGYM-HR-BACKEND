import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BaseCrudService } from '../../common/services/base-crud.service';

@Injectable()
export class BranchService extends BaseCrudService<BranchDocument> {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {
    super(branchModel);
  }

  async create(createDto: CreateBranchDto) {
    const { name, order } = createDto;

    // Check duplicate name
    const existingName = await this.branchModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      throw new BadRequestException(`Branch "${name}" already exists.`);
    }

    // Check duplicate order
    const existingOrder = await this.branchModel.findOne({ order });
    if (existingOrder) {
      throw new BadRequestException(`Order number ${order} is already assigned to "${existingOrder.name}".`);
    }

    const newBranch = new this.branchModel(createDto);
    return newBranch.save();
  }

  async findAll(search?: string, status?: string, page?: number, limit?: number) {
    const { data, total, page: pageOut, limit: limitOut, totalPages } = await this.findAllBase({
      search,
      searchFields: ['name', 'address', 'phone'],
      status,
      page,
      limit,
      sort: { order: 1, createdAt: -1 },
    });

    // Aggregate system-wide KPI statistics for Branches
    const totalBranches = await this.branchModel.countDocuments();
    const activeBranches = await this.branchModel.countDocuments({ status: 'active' });
    const inactiveBranches = await this.branchModel.countDocuments({ status: 'inactive' });
    const maxOrderDoc = await this.branchModel.findOne().sort({ order: -1 }).select('order').exec();
    const maxDisplayOrder = maxOrderDoc ? maxOrderDoc.order : 0;

    return {
      data,
      total,
      page: pageOut,
      limit: limitOut,
      totalPages,
      stats: {
        totalBranches,
        activeBranches,
        inactiveBranches,
        maxDisplayOrder,
      },
    };
  }

  async findOne(id: string) {
    return this.findOneBase(id, 'Branch');
  }

  async update(id: string, updateDto: UpdateBranchDto) {
    const branch = await this.branchModel.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch not found`);
    }

    if (updateDto.name && updateDto.name.trim().toLowerCase() !== branch.name.toLowerCase()) {
      const existingName = await this.branchModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateDto.name.trim()}$`, 'i') },
      });
      if (existingName) {
        throw new BadRequestException(`Branch "${updateDto.name}" already exists.`);
      }
    }

    if (updateDto.order && updateDto.order !== branch.order) {
      const existingOrder = await this.branchModel.findOne({
        _id: { $ne: id },
        order: updateDto.order,
      });
      if (existingOrder) {
        throw new BadRequestException(`Order number ${updateDto.order} is already assigned to "${existingOrder.name}".`);
      }
    }

    if (updateDto.operatingHours) {
      branch.operatingHours = updateDto.operatingHours;
      branch.markModified('operatingHours');
    }
    if (updateDto.name) branch.name = updateDto.name;
    if (updateDto.order !== undefined) branch.order = updateDto.order;
    if (updateDto.status) branch.status = updateDto.status;
    if (updateDto.address) branch.address = updateDto.address;
    if (updateDto.phone) branch.phone = updateDto.phone;
    if (updateDto.website !== undefined) branch.website = updateDto.website;
    if (updateDto.openingTime) branch.openingTime = updateDto.openingTime;
    if (updateDto.closingTime) branch.closingTime = updateDto.closingTime;

    return branch.save();
  }

  async remove(id: string) {
    return this.removeBase(id, 'Branch');
  }
}
